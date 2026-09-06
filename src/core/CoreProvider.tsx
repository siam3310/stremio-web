import React, { useEffect, useRef, useState } from 'react';
import CoreContext from './CoreContext';
import createTransport from './createTransport';
import Error from './Error';
const { DEFAULT_AUTH } = require('./authInjection');

const transport = createTransport();

type Props = {
    appInfo: object,
    children: React.ReactNode,
};

const Core = (props: Props) => {
    const initialized = useRef(false);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<any>(null);

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

        window.core = transport;
        window.onCoreEvent = onCoreEvent;

        if (initialized.current) return;
        initialized.current = true;

        const initCore = async () => {
            try {
                await transport.init(props.appInfo);

                // Verify and synchronize user authentication with the core and Stremio API
                try {
                    const ctxState: any = await transport.getState('ctx');
                    if (ctxState?.profile?.auth) {
                        transport.dispatch({ action: 'Ctx', args: { action: 'PullUserFromAPI' } });
                        transport.dispatch({ action: 'Ctx', args: { action: 'PullAddonsFromAPI' } });
                        transport.dispatch({ action: 'Ctx', args: { action: 'SyncLibraryWithAPI' } });
                    } else {
                        const hasReloaded = sessionStorage.getItem('stremio_auto_auth_synced');
                        if (!hasReloaded) {
                            sessionStorage.setItem('stremio_auto_auth_synced', 'true');
                            const raw = window.localStorage.getItem('profile');
                            if (raw) {
                                try {
                                    const parsed = JSON.parse(raw);
                                    if (parsed && typeof parsed === 'object') {
                                        parsed.auth = DEFAULT_AUTH;
                                        window.localStorage.setItem('profile', JSON.stringify(parsed));
                                    }
                                } catch (_err) {
                                    // Ignore parse error
                                }
                            }
                            window.location.reload();
                            return;
                        }
                    }
                } catch (syncErr) {
                    console.warn('Auto auth synchronization warning:', syncErr);
                }

                setReady(true);
                setError(null);
            } catch (e: any) {
                console.error('Failed to initialize core:', e);
                const msg = String(e?.message || '');
                if (msg.includes('Serialization error') || msg.includes('missing field')) {
                    try {
                        window.localStorage.removeItem('profile');
                        // Reload so wasm worker starts fresh with empty profile
                        window.location.reload();
                        return;
                    } catch (reloadErr) {
                        console.error('Reload failed:', reloadErr);
                    }
                }
                setReady(false);
                setError(e);
            }
        };

        initCore();
    }, []);

    return (
        <CoreContext.Provider value={{ transport, on, off }}>
            { error && <Error message={error.message || String(error)} /> }
            { ready && !error && props.children }
            { !ready && !error && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0e0c1a', color: '#fff' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ opacity: 0.8, fontSize: 16, fontWeight: 500, letterSpacing: 0.5 }} dangerouslySetInnerHTML={{ __html: 'Loading...' }} />
                    </div>
                </div>
            ) }
        </CoreContext.Provider>
    );
};

export default Core;
