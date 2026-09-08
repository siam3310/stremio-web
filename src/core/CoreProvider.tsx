import React, { useEffect, useRef, useState } from 'react';
import CoreContext from './CoreContext';
import createTransport from './createTransport';
import Error from './Error';
const { DEFAULT_ADDONS } = require('./authInjection');

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
                setReady(true);
                setError(null);

                // Ensure custom addons from user export are installed and local addon is uninstalled (non-blocking)
                setTimeout(async () => {
                    try {
                        const ctxState: any = await transport.getState('ctx');
                        const installedAddons = ctxState?.profile?.addons || [];
                        const installedUrls = new Set(installedAddons.map((a: any) => a && a.transportUrl));

                        // Uninstall local file add-on if present
                        for (const a of installedAddons) {
                            const id = a?.manifest?.id;
                            const url = a?.transportUrl;
                            if (id === 'org.stremio.local' || (url && (url.includes('11470') || url.includes('local-addon')))) {
                                transport.dispatch({
                                    action: 'Ctx',
                                    args: {
                                        action: 'UninstallAddon',
                                        args: { transportUrl: a.transportUrl }
                                    }
                                });
                            }
                        }

                        for (const addon of DEFAULT_ADDONS) {
                            if (addon && addon.transportUrl && !installedUrls.has(addon.transportUrl)) {
                                transport.dispatch({
                                    action: 'Ctx',
                                    args: {
                                        action: 'InstallAddon',
                                        args: addon
                                    }
                                });
                            }
                        }
                    } catch (addonErr) {
                        console.warn('Default addons initialization warning:', addonErr);
                    }
                }, 10);
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
                <div
                    id="app-preloader"
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100vh',
                        width: '100vw',
                        background: 'radial-gradient(ellipse at center, #1b1836 0%, #0c0a18 100%)',
                        color: '#fff',
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        zIndex: 99999,
                    }}
                >
                    <div
                        style={{
                            position: 'relative',
                            width: 56,
                            height: 56,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <div
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                border: '3px solid rgba(138, 92, 246, 0.15)',
                                borderTopColor: '#7c5dfa',
                                borderRightColor: '#a78bfa',
                                animation: 'stremio-preloader-spin 0.85s cubic-bezier(0.5, 0.1, 0.5, 0.9) infinite',
                            }}
                        />
                    </div>
                    <style>{`
                        @keyframes stremio-preloader-spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            ) }
        </CoreContext.Provider>
    );
};

export default Core;
