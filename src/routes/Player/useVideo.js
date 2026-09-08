// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const Video = require('@stremio/stremio-video');
const EventEmitter = require('eventemitter3');
const shakaEngine = require('./shakaEngine');

// Configure video player media source buffer size and next segment pre-fetching
try {
    const hlsConfig = require('@stremio/stremio-video/src/HTMLVideo/hlsConfig');
    if (hlsConfig) {
        hlsConfig.maxBufferSize = 512 * 1024 * 1024; // 512 MB media source buffer size
        hlsConfig.maxBufferLength = 240; // 240 seconds forward buffer
        hlsConfig.maxMaxBufferLength = 480; // 480 seconds max forward buffer
        hlsConfig.backBufferLength = 120; // 120 seconds back buffer
        hlsConfig.startFragPrefetch = true; // Pre-fetch next segment of the video stream
        hlsConfig.progressive = true;
        hlsConfig.enableWorker = true;
        hlsConfig.lowLatencyMode = false; // Disable low-latency live mode to guarantee deep bufferless VOD streaming
        hlsConfig.highBufferWatchdogPeriod = 2;
        hlsConfig.maxFragLookUpTolerance = 0.25;
        hlsConfig.maxBufferHole = 0.5;
        hlsConfig.fragLoadingMaxRetry = 8;
        hlsConfig.levelLoadingMaxRetry = 6;
    }
} catch (_e) {
    // Silently continue if hlsConfig not accessible directly
}

const noop = () => null;

/**
 * AntiStutterGuard prevents the rapid "play, stop, play, stop" buffering loop.
 * When a buffer underrun occurs, it prevents micro-stutters by holding playback
 * until a safe cushion of buffer is loaded (4.0s) before smoothly resuming.
 */
class AntiStutterGuard {
    constructor() {
        this.video = null;
        this.isStalled = false;
        this.wasPlayingBeforeStall = false;
        this.stallTimer = null;
        this.minBufferSeconds = 4.0;
        this.onWaiting = this.onWaiting.bind(this);
        this.onPlaying = this.onPlaying.bind(this);
        this.onProgress = this.onProgress.bind(this);
        this.onSeeking = this.onSeeking.bind(this);
        this.onPause = this.onPause.bind(this);
    }

    attach(videoEl) {
        if (this.video === videoEl) return;
        this.detach();
        if (!videoEl) return;
        this.video = videoEl;
        this.video.addEventListener('waiting', this.onWaiting);
        this.video.addEventListener('stalled', this.onWaiting);
        this.video.addEventListener('playing', this.onPlaying);
        this.video.addEventListener('progress', this.onProgress);
        this.video.addEventListener('seeking', this.onSeeking);
        this.video.addEventListener('pause', this.onPause);
    }

    detach() {
        if (this.video) {
            this.video.removeEventListener('waiting', this.onWaiting);
            this.video.removeEventListener('stalled', this.onWaiting);
            this.video.removeEventListener('playing', this.onPlaying);
            this.video.removeEventListener('progress', this.onProgress);
            this.video.removeEventListener('seeking', this.onSeeking);
            this.video.removeEventListener('pause', this.onPause);
            this.video = null;
        }
        if (this.stallTimer) {
            clearTimeout(this.stallTimer);
            this.stallTimer = null;
        }
        this.isStalled = false;
    }

    getForwardBuffer() {
        if (!this.video) return 0;
        try {
            const cur = this.video.currentTime;
            for (let i = 0; i < this.video.buffered.length; i++) {
                if (this.video.buffered.start(i) <= cur + 0.2 && cur <= this.video.buffered.end(i)) {
                    return this.video.buffered.end(i) - cur;
                }
            }
        } catch (_e) {
            noop();
        }
        return 0;
    }

    onWaiting() {
        if (!this.video || this.isStalled) return;
        if (this.video.paused && !this.wasPlayingBeforeStall) return;

        this.isStalled = true;
        this.wasPlayingBeforeStall = true;

        // Temporarily pause to allow stream buffer to replenish without rapid frame stuttering
        try {
            this.video.pause();
        } catch (_e) {
            noop();
        }

        if (this.stallTimer) clearTimeout(this.stallTimer);
        this.stallTimer = setTimeout(() => {
            this.attemptResume();
        }, 6500);
    }

    onProgress() {
        if (!this.isStalled || !this.video) return;
        const forward = this.getForwardBuffer();
        const duration = this.video.duration;
        const isNearEnd = isFinite(duration) && (duration - this.video.currentTime) < this.minBufferSeconds;

        if (forward >= this.minBufferSeconds || isNearEnd) {
            this.attemptResume();
        }
    }

    onPlaying() {
        this.isStalled = false;
        this.wasPlayingBeforeStall = true;
        if (this.stallTimer) {
            clearTimeout(this.stallTimer);
            this.stallTimer = null;
        }
    }

    onPause() {
        if (!this.isStalled) {
            this.wasPlayingBeforeStall = false;
        }
    }

    onSeeking() {
        this.isStalled = false;
        if (this.stallTimer) {
            clearTimeout(this.stallTimer);
            this.stallTimer = null;
        }
    }

    attemptResume() {
        if (this.stallTimer) {
            clearTimeout(this.stallTimer);
            this.stallTimer = null;
        }
        if (this.isStalled && this.video && this.wasPlayingBeforeStall) {
            this.isStalled = false;
            try {
                const p = this.video.play();
                if (p && typeof p.catch === 'function') {
                    p.catch(noop);
                }
            } catch (_e) {
                noop();
            }
        }
    }
}

const antiStutterGuard = new AntiStutterGuard();

const events = new EventEmitter();

const prefetchStreamSegments = (streamUrl) => {
    if (!streamUrl || typeof streamUrl !== 'string') return;
    try {
        if (streamUrl.includes('m3u8')) {
            fetch(streamUrl, { method: 'GET', mode: 'cors' })
                .then((res) => (res.ok ? res.text() : null))
                .then((playlistText) => {
                    if (!playlistText) return;
                    const lines = playlistText.split('\n');
                    const segmentLine = lines.find((l) => l && !l.startsWith('#') && l.trim().length > 0);
                    if (segmentLine) {
                        const trimmed = segmentLine.trim();
                        const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);
                        const nextSegmentUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
                        // Pre-fetch the next segment of the video stream to prime browser cache
                        fetch(nextSegmentUrl, { method: 'GET', mode: 'cors' }).catch(noop);
                    }
                })
                .catch(noop);
        }
    } catch (_e) {
        // Non-blocking prefetch failure
    }
};

const useVideo = () => {
    const video = React.useRef(null);
    const containerRef = React.useRef(null);
    const currentStreamRef = React.useRef(null);

    const [state, setState] = React.useState({
        manifest: null,
        stream: null,
        paused: null,
        time: null,
        duration: null,
        buffering: null,
        buffered: null,
        volume: null,
        muted: null,
        playbackSpeed: null,
        videoScale: null,
        videoParams: null,
        hdrInfo: null,
        audioTracks: [],
        selectedAudioTrackId: null,
        subtitlesTracks: [],
        selectedSubtitlesTrackId: null,
        subtitlesOffset: null,
        subtitlesSize: null,
        subtitlesTextColor: null,
        subtitlesBackgroundColor: null,
        subtitlesOutlineColor: null,
        extraSubtitlesTracks: [],
        selectedExtraSubtitlesTrackId: null,
        extraSubtitlesSize: null,
        extraSubtitlesDelay: null,
        extraSubtitlesOffset: null,
        extraSubtitlesTextColor: null,
        extraSubtitlesBackgroundColor: null,
        extraSubtitlesOutlineColor: null,
        assSubtitlesStylingActive: false,
        fullscreen: null,
    });

    const dispatch = React.useCallback((action, options) => {
        if (video.current && containerRef.current) {
            try {
                video.current.dispatch(action, {
                    ...options,
                    containerElement: containerRef.current,
                });
            } catch (error) {
                console.error('Video:', error);
            }
        }
    }, []);

    const load = (args, options) => {
        if (args?.stream?.url) {
            currentStreamRef.current = args.stream;
            prefetchStreamSegments(args.stream.url);
        }
        dispatch({
            type: 'command',
            commandName: 'load',
            commandArgs: args
        }, options);

        // Enhance with Shaka Video Player for DASH manifests and AntiStutterGuard for bufferless streaming
        if (args?.stream?.url) {
            const streamUrl = args.stream.url;
            const startTime = args.time !== null && isFinite(args.time) ? parseInt(args.time, 10) / 1000 : 0;
            const isMpd = streamUrl.includes('.mpd') || streamUrl.includes('manifest=mpd');
            setTimeout(() => {
                try {
                    if (containerRef.current) {
                        const videoEl = containerRef.current.querySelector('video');
                        if (videoEl) {
                            videoEl.preload = 'auto';
                            antiStutterGuard.attach(videoEl);
                            // Only activate Shaka Player for DASH manifests where it is designed to operate
                            if (isMpd && shakaEngine.isSupported()) {
                                const initialized = shakaEngine.init(videoEl);
                                if (initialized) {
                                    shakaEngine.load(streamUrl, startTime);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.warn('[useVideo] Shaka engine activation warning:', err);
                }
            }, 80);
        }
    };

    const unload = () => {
        currentStreamRef.current = null;
        try {
            antiStutterGuard.detach();
            shakaEngine.destroy();
        } catch (_e) {
            noop();
        }
        dispatch({
            type: 'command',
            commandName: 'unload',
        });
    };

    const addExtraSubtitlesTracks = (tracks) => {
        dispatch({
            type: 'command',
            commandName: 'addExtraSubtitlesTracks',
            commandArgs: {
                tracks,
            },
        });
    };

    const addLocalSubtitles = (filename, buffer) => {
        dispatch({
            type: 'command',
            commandName: 'addLocalSubtitles',
            commandArgs: {
                filename,
                buffer,
            },
        });
    };

    const setProp = (name, value) => {
        dispatch({ type: 'setProp', propName: name, propValue: value });
    };

    const setPaused = (state) => {
        setProp('paused', state);
    };

    const setVolume = (volume) => {
        setProp('volume', volume);
    };

    const setMuted = (state) => {
        setProp('muted', state);
    };

    const setTime = (time) => {
        setProp('time', time);
    };

    const setPlaybackSpeed = (rate) => {
        setProp('playbackSpeed', rate);
    };

    const setAudioTrack = (id) => {
        setProp('selectedAudioTrackId', id);
    };

    const setSubtitlesTrack = (id) => {
        setProp('selectedSubtitlesTrackId', id);
        setProp('selectedExtraSubtitlesTrackId', null);
    };

    const setExtraSubtitlesTrack = (id) => {
        setProp('selectedSubtitlesTrackId', null);
        setProp('selectedExtraSubtitlesTrackId', id);
    };

    const setSubtitlesDelay = (delay) => {
        setProp('extraSubtitlesDelay', delay);
    };

    const setSubtitlesSize = (size) => {
        setProp('subtitlesSize', size);
        setProp('extraSubtitlesSize', size);
    };

    const setSubtitlesOffset = (offset) => {
        setProp('subtitlesOffset', offset);
        setProp('extraSubtitlesOffset', offset);
    };

    const setSubtitlesOffsetMinimum = React.useCallback((offset) => {
        dispatch({
            type: 'setProp',
            propName: 'subtitlesOffsetMinimum',
            propValue: offset,
        });
    }, [dispatch]);

    const setVideoScale = (scale) => {
        setProp('videoScale', scale);
    };

    const setFullscreen = (state) => {
        setProp('fullscreen', state);
    };

    const setSubtitlesTextColor = (color) => {
        setProp('subtitlesTextColor', color);
        setProp('extraSubtitlesTextColor', color);
    };

    const setSubtitlesBackgroundColor = (color) => {
        setProp('subtitlesBackgroundColor', color);
        setProp('extraSubtitlesBackgroundColor', color);
    };

    const setSubtitlesOutlineColor = (color) => {
        setProp('subtitlesOutlineColor', color);
        setProp('extraSubtitlesOutlineColor', color);
    };

    const onError = (error) => {
        // If error 83 occurs and Shaka engine was active, recover by destroying Shaka and falling back to native video
        if (error && error.code === 83 && shakaEngine.player) {
            console.warn('[useVideo] Recovering from Shaka error 83 via native playback fallback');
            try {
                shakaEngine.destroy();
            } catch (_e) {
                noop();
            }
            if (containerRef.current && currentStreamRef.current?.url) {
                const videoEl = containerRef.current.querySelector('video');
                if (videoEl) {
                    const fallbackUrl = currentStreamRef.current.url;
                    videoEl.src = fallbackUrl;
                    videoEl.load();
                    const p = videoEl.play();
                    if (p && typeof p.catch === 'function') {
                        p.catch(noop);
                    }
                    return;
                }
            }
        }
        events.emit('error', error);
    };

    const onEnded = () => {
        events.emit('ended');
    };

    const onSubtitlesTrackLoaded = (track) => {
        events.emit('subtitlesTrackLoaded', track);
    };

    const onExtraSubtitlesTrackLoaded = (track) => {
        events.emit('extraSubtitlesTrackLoaded', track);
    };

    const onExtraSubtitlesTrackAdded = (track) => {
        events.emit('extraSubtitlesTrackAdded', track);
    };

    const onPropChanged = (name, value) => {
        setState((state) => ({
            ...state,
            [name]: value
        }));
    };

    const onImplementationChanged = (manifest) => {
        manifest.props.forEach((propName) => dispatch(({ type: 'observeProp', propName })));
        setState((state) => ({
            ...state,
            manifest
        }));

        events.emit('implementationChanged', manifest);
    };

    React.useEffect(() => {
        video.current = new Video();
        video.current.on('error', onError);
        video.current.on('ended', onEnded);
        video.current.on('propChanged', onPropChanged);
        video.current.on('propValue', onPropChanged);
        video.current.on('implementationChanged', onImplementationChanged);
        video.current.on('subtitlesTrackLoaded', onSubtitlesTrackLoaded);
        video.current.on('extraSubtitlesTrackLoaded', onExtraSubtitlesTrackLoaded);
        video.current.on('extraSubtitlesTrackAdded', onExtraSubtitlesTrackAdded);

        if (containerRef.current) {
            const vid = containerRef.current.querySelector('video');
            if (vid) {
                vid.preload = 'auto';
            }
        }

        return () => {
            try {
                antiStutterGuard.detach();
                shakaEngine.destroy();
            } catch (_e) {
                // Ignore cleanup error
            }
            if (video.current) {
                try {
                    video.current.destroy();
                } catch (err) {
                    console.error('Error destroying video:', err);
                }
            }
        };
    }, []);

    return {
        events,
        containerRef,
        state,
        load,
        unload,
        addExtraSubtitlesTracks,
        addLocalSubtitles,
        setPaused,
        setVolume,
        setMuted,
        setTime,
        setPlaybackSpeed,
        setAudioTrack,
        setSubtitlesTrack,
        setSubtitlesDelay,
        setSubtitlesSize,
        setSubtitlesOffset,
        setSubtitlesOffsetMinimum,
        setSubtitlesTextColor,
        setSubtitlesBackgroundColor,
        setSubtitlesOutlineColor,
        setExtraSubtitlesTrack,
        setVideoScale,
        setFullscreen,
    };
};

module.exports = useVideo;
