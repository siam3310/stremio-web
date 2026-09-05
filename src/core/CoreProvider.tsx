import React, { useEffect, useRef, useState } from 'react';
import CoreContext from './CoreContext';
import createTransport from './createTransport';
import Error from './Error';
import { AUTH_KEY } from './authInjection';

const transport = createTransport();

type Props = {
    appInfo: object,
    children: React.ReactNode,
};

const Core = (props: Props) => {
    const initialized = useRef(false);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<Error | null>();

    const stateListeners = useRef<CoreStateListener[]>([]);
    const eventListeners = useRef<CoreEventListener[]>([]);
    const errorListeners = useRef<CoreErrorListener[]>([]);

    const on = (name: CoreListenerType, listener: CoreListener) => {
        if (name === 'state') stateListeners.current = [...stateListeners.current, listener as CoreStateListener];
        if (name === 'event') eventListeners.current = [...eventListeners.current, listener as CoreEventListener];
        if (name === 'error') errorListeners.current = [...errorListeners.current, listener as CoreErrorListener];
    };

    const off = (name: CoreListenerType, listener: CoreListener) => {
        if (name === 'state') stateListeners.current = stateListeners.current.filter((l) => l !== listener);
        if (name === 'event') eventListeners.current = eventListeners.current.filter((l) => l !== listener);
        if (name === 'error') errorListeners.current = errorListeners.current.filter((l) => l !== listener);
    };

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const onCoreEvent = ({ name, args }: NewStateEvent | CoreEventEvent) => {
            switch (name) {
                case 'NewState':
                    stateListeners.current.forEach((listener) => listener(args));
                    break;

                case 'CoreEvent': {
                    switch (args.event) {
                        case 'Error': {
                            const { source, error } = args.args;
                            errorListeners.current.forEach((listener) => listener(
                                source,
                                error,
                            ));
                            break;
                        }
                        default:
                            eventListeners.current.forEach((listener) => listener(
                                args.event,
                                args.args,
                            ));
                            break;
                    }
                    break;
                }

                default:
                    break;
            }
        };

        const initCore = async () => {
            try {
                await transport.init(props.appInfo);
                window.core = transport;
                window.onCoreEvent = onCoreEvent;
                setReady(true);
                setError(null);

                try {
                    const ctx = (await transport.getState('ctx')) as any;
                    if (!ctx?.profile?.auth?.key && AUTH_KEY) {
                        await transport.dispatch({
                            action: 'Ctx',
                            args: {
                                action: 'Authenticate',
                                args: {
                                    type: 'LoginWithToken',
                                    token: AUTH_KEY,
                                },
                            },
                        });
                    }
                } catch (authError) {
                    console.warn('Auto-login error:', authError);
                }
            } catch (e: any) {
                console.error('Failed to initialize core:', e);
                const msg = String(e?.message || '');
                if (msg.includes('Serialization error') || msg.includes('missing field')) {
                    try {
                        window.localStorage.removeItem('profile');
                        await transport.init(props.appInfo);
                        window.core = transport;
                        window.onCoreEvent = onCoreEvent;
                        setReady(true);
                        setError(null);

                        if (AUTH_KEY) {
                            await transport.dispatch({
                                action: 'Ctx',
                                args: {
                                    action: 'Authenticate',
                                    args: {
                                        type: 'LoginWithToken',
                                        token: AUTH_KEY,
                                    },
                                },
                            });
                        }
                        return;
                    } catch (retryErr: any) {
                        console.error('Core initialization retry failed:', retryErr);
                        setReady(false);
                        setError(retryErr);
                        return;
                    }
                }
                setReady(false);
                setError(e);
            }
        };

        initCore();

        return () => {
            stateListeners.current = [];
            eventListeners.current = [];
            errorListeners.current = [];
        };
    }, []);

    return (
        <CoreContext.Provider value={{ transport, on, off }}>
            { error && !ready && <Error message={error.message} /> }
            { ready && !error && props.children }
        </CoreContext.Provider>
    );
};

export default Core;
