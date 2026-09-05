import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import magnet from 'magnet-uri';
import { useCore } from 'stremio/core';
import useToast from 'stremio/common/Toast/useToast';

const HTTP_REGEX = /^https?:\/\/.+/i;

const usePlayUrl = () => {
    const navigate = useNavigate();
    const core = useCore();
    const toast = useToast();

    const handlePlayUrl = useCallback(async (text: string): Promise<boolean> => {
        if (!text || !text.trim()) return false;
        const trimmed = text.trim();

        if (HTTP_REGEX.test(trimmed)) {
            toast.show({
                type: 'success',
                title: 'Loading HTTP stream…',
                timeout: 3000
            });
            try {
                const encoded = await core.transport.encodeStream({
                    name: '',
                    description: '',
                    url: trimmed,
                });
                if (typeof encoded === 'string') {
                    navigate(`/player/${encodeURIComponent(encoded)}`);
                    return true;
                }
            } catch (e) {
                console.error('Failed to encode stream:', e);
            }
            toast.show({
                type: 'error',
                title: 'Failed to load HTTP stream.',
                timeout: 5000
            });
            return false;
        }

        const parsed = magnet.decode(trimmed);
        if (parsed && typeof parsed.infoHash === 'string') {
            toast.show({
                type: 'error',
                title: 'P2P / Magnet streams are not supported in direct streaming mode. Please provide direct HTTP(S), MP4, or HLS stream URLs.',
                timeout: 5000
            });
            return false;
        }

        return false;
    }, []);

    return { handlePlayUrl };
};

export default usePlayUrl;
