// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { withCoreSuspender } from '../CoreSuspender';
import { getKeyboardShortcutKey } from '../Shortcuts';
import onShortcut from '../Shortcuts/onShortcut';
import useSettings from '../useSettings';
import FullscreenContext, { type FullscreenContextValue } from './FullscreenContext';
import { usePlatform } from '../Platform';

type Props = {
    children: React.ReactNode,
};

const FullscreenProvider = ({ children }: Props) => {
    const { shell } = usePlatform();
    const [settings] = useSettings();
    const escExitFullscreen = settings.escExitFullscreen;

    const videoElementRef = useRef<HTMLVideoElement | null>(null);
    const [hasVideoElement, setHasVideoElement] = useState(false);

    const [fullscreen, setFullscreen] = useState<boolean>(() => {
        if (typeof document === 'undefined') return false;
        return document.fullscreenElement === document.documentElement;
    });

    const setVideoElement = useCallback((el: HTMLVideoElement | null) => {
        videoElementRef.current = el;
        setHasVideoElement(el !== null);
    }, []);

    const supported = true;

    const requestFullscreen = useCallback(async () => {
        if (shell.active) {
            shell.send('win-set-visibility', { fullscreen: true });
            return;
        }

        const docEl = document.documentElement as any;
        let entered = false;

        if (document.fullscreenEnabled || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen) {
            try {
                if (docEl.requestFullscreen) {
                    await docEl.requestFullscreen();
                    entered = true;
                } else if (docEl.webkitRequestFullscreen) {
                    await docEl.webkitRequestFullscreen();
                    entered = true;
                } else if (docEl.mozRequestFullScreen) {
                    await docEl.mozRequestFullScreen();
                    entered = true;
                } else if (docEl.msRequestFullscreen) {
                    await docEl.msRequestFullscreen();
                    entered = true;
                }
            } catch (err) {
                console.warn('Native requestFullscreen failed, attempting video element fallback:', err);
            }
        }

        if (!entered && videoElementRef.current) {
            const vid = videoElementRef.current as any;
            if (typeof vid.webkitEnterFullscreen === 'function') {
                try {
                    vid.webkitEnterFullscreen();
                    entered = true;
                } catch (err) {
                    console.warn('Video webkitEnterFullscreen failed:', err);
                }
            } else if (typeof vid.requestFullscreen === 'function') {
                try {
                    await vid.requestFullscreen();
                    entered = true;
                } catch (err) {
                    console.warn('Video requestFullscreen failed:', err);
                }
            }
        }

        // Always update state and apply pseudo-fullscreen class as guarantee
        document.documentElement.classList.add('fullscreen-mode');
        setFullscreen(true);
    }, [shell]);

    const exitFullscreen = useCallback(() => {
        if (shell.active) {
            shell.send('win-set-visibility', { fullscreen: false });
            return;
        }

        const doc = document as any;
        if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
            try {
                if (doc.exitFullscreen) {
                    doc.exitFullscreen();
                } else if (doc.webkitExitFullscreen) {
                    doc.webkitExitFullscreen();
                } else if (doc.mozCancelFullScreen) {
                    doc.mozCancelFullScreen();
                } else if (doc.msExitFullscreen) {
                    doc.msExitFullscreen();
                }
            } catch (err) {
                console.warn('Native exitFullscreen error:', err);
            }
        }

        if (videoElementRef.current && (videoElementRef.current as any).webkitDisplayingFullscreen) {
            try {
                (videoElementRef.current as any).webkitExitFullscreen();
            } catch (err) {
                console.warn('Video webkitExitFullscreen error:', err);
            }
        }

        document.documentElement.classList.remove('fullscreen-mode');
        setFullscreen(false);
    }, [shell]);

    const toggleFullscreen = useCallback(() => {
        fullscreen ? exitFullscreen() : requestFullscreen();
    }, [fullscreen, exitFullscreen, requestFullscreen]);

    onShortcut('fullscreen', toggleFullscreen, [toggleFullscreen]);

    useEffect(() => {
        const videoElement = videoElementRef.current;

        const onWindowVisibilityChanged = (state: WindowVisibility) => {
            setFullscreen(state.isFullscreen === true);
        };

        const onFullscreenChange = () => {
            setFullscreen(document.fullscreenElement === document.documentElement);
        };

        const onWebkitFullscreenChange = () => {
            setFullscreen((videoElement as any)?.webkitDisplayingFullscreen === true);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            const keyboardKey = getKeyboardShortcutKey(event);

            if (keyboardKey === 'Escape' && escExitFullscreen) {
                exitFullscreen();
            }

            if (keyboardKey === 'F11' && shell.active) {
                toggleFullscreen();
            }
        };

        shell.on('win-visibility-changed', onWindowVisibilityChanged);
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('fullscreenchange', onFullscreenChange);
        videoElement?.addEventListener('webkitbeginfullscreen', onWebkitFullscreenChange);
        videoElement?.addEventListener('webkitendfullscreen', onWebkitFullscreenChange);

        return () => {
            shell.off('win-visibility-changed', onWindowVisibilityChanged);
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            videoElement?.removeEventListener('webkitbeginfullscreen', onWebkitFullscreenChange);
            videoElement?.removeEventListener('webkitendfullscreen', onWebkitFullscreenChange);
        };
    }, [shell, toggleFullscreen, exitFullscreen, escExitFullscreen, hasVideoElement]);

    const value = useMemo<FullscreenContextValue>(
        () => [fullscreen, requestFullscreen, exitFullscreen, toggleFullscreen, supported, setVideoElement],
        [fullscreen, requestFullscreen, exitFullscreen, toggleFullscreen, supported, setVideoElement]
    );

    return (
        <FullscreenContext.Provider value={value}>
            {children}
        </FullscreenContext.Provider>
    );
};

export default withCoreSuspender(FullscreenProvider);
