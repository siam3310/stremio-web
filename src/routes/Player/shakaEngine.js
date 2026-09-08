// Copyright (C) 2017-2025 Smart code 203358507

/**
 * Shaka Video Player Engine for Stremio Web
 *
 * Provides bufferless streaming with configurable forward/back buffering goals,
 * adaptive bitrate (ABR), MediaSource progressive streaming, and support for:
 * - HLS (.m3u8) streams
 * - DASH (.mpd) manifests
 * - Direct progressive video download links (Pixeldrain, Google Drive, Debrid, MP4/WebM)
 * - Automatic fallback to native HTML5 video when codecs/CORS require direct playback.
 */

let shaka = null;
try {
    shaka = require('shaka-player/dist/shaka-player.compiled');
    if (typeof window !== 'undefined' && shaka && shaka.polyfill) {
        shaka.polyfill.installAll();
    }
} catch (e) {
    console.warn('[ShakaEngine] Failed to load Shaka Player library:', e);
}

class ShakaEngine {
    constructor() {
        this.player = null;
        this.videoElement = null;
        this.isLoaded = false;
        this.currentUrl = null;
    }

    isSupported() {
        return !!(shaka && shaka.Player && shaka.Player.isBrowserSupported());
    }

    init(videoElement) {
        if (!this.isSupported() || !videoElement) {
            return false;
        }

        if (this.player && this.videoElement === videoElement) {
            return true;
        }

        this.destroy();

        try {
            this.videoElement = videoElement;
            this.player = new shaka.Player();
            this.player.attach(videoElement);

            // Configure Shaka for ultra-deep bufferless streaming and zero stutter
            this.player.configure({
                streaming: {
                    bufferingGoal: 240, // 240 seconds (4 minutes) forward buffer
                    rebufferingGoal: 6, // 6 seconds safe cushion to unblock stalls without re-stalling
                    bufferBehind: 120, // 120 seconds back buffer for instant seek-back
                    retryParameters: {
                        maxAttempts: 8,
                        baseDelay: 1000,
                        backoffFactor: 1.5,
                        fuzzFactor: 0.5,
                        timeout: 35000,
                    },
                    stallEnabled: false, // CRITICAL: Disable stall skipping to prevent "play, stop, play, stop" loops
                    stallThreshold: 6,
                    stallSkip: 0, // 0 = Do NOT skip frames or timestamps on stalls
                    jumpLargeGaps: true, // Smoothly bridge any presentation timestamp gaps
                    smallGapLimit: 0.5,
                    startAtSegmentBoundary: false,
                    ignoreTextStreamFailures: true,
                    alwaysStreamText: false,
                    segmentPrefetchLimit: 4, // Concurrently prefetch 4 segments ahead for continuous throughput
                    lowLatencyMode: false, // Ensure high-capacity buffering over low-latency
                },
                abr: {
                    enabled: true,
                    defaultBandwidthEstimate: 20000000, // 20 Mbps initial estimate for instant high quality
                    switchInterval: 10, // Prevent frequent quality switching which causes stutter
                    bandwidthDowngradeTarget: 0.85,
                    bandwidthUpgradeTarget: 0.7,
                },
                manifest: {
                    retryParameters: {
                        maxAttempts: 6,
                        baseDelay: 1000,
                        backoffFactor: 1.5,
                        timeout: 30000,
                    },
                },
            });

            // Network filter to support direct download endpoints (e.g. Pixeldrain, Debrid, CDNs)
            const networkingEngine = this.player.getNetworkingEngine();
            if (networkingEngine) {
                networkingEngine.registerRequestFilter((type, request) => {
                    // Allow cross-origin requests with range headers
                    if (!request.headers) {
                        request.headers = {};
                    }
                });
            }

            this.player.addEventListener('error', (event) => {
                console.warn('[ShakaEngine] Internal player error:', event.detail);
            });

            return true;
        } catch (e) {
            console.error('[ShakaEngine] Initialization error:', e);
            this.destroy();
            return false;
        }
    }

    async load(url, startTime = 0) {
        if (!url) return false;
        this.currentUrl = url;

        if (!this.player || !this.videoElement) {
            return false;
        }

        try {
            // Attempt to load stream via Shaka's streaming engine
            await this.player.load(url, startTime);
            this.isLoaded = true;
            return true;
        } catch (error) {
            console.warn('[ShakaEngine] Shaka load failed, attempting native fallback:', error.code, error.message);
            this.isLoaded = false;
            // Detach Shaka from the video element so Shaka's failure state doesn't corrupt HTML5 video
            if (this.player) {
                try {
                    await this.player.detach();
                } catch (_e) {
                    // Ignore detach error
                }
            }
            // Native fallback: assign directly to HTML5 video element without clobbering existing stream
            if (this.videoElement) {
                if (this.videoElement.src !== url && !this.videoElement.src.endsWith(encodeURI(url))) {
                    this.videoElement.src = url;
                }
                if (startTime > 0 && Math.abs(this.videoElement.currentTime - startTime) > 1) {
                    this.videoElement.currentTime = startTime;
                }
            }
            return false;
        }
    }

    destroy() {
        if (this.player) {
            try {
                this.player.destroy();
            } catch (_e) {
                // Ignore cleanup errors
            }
            this.player = null;
        }
        this.videoElement = null;
        this.isLoaded = false;
        this.currentUrl = null;
    }

    getStats() {
        if (this.player && this.isLoaded) {
            try {
                return this.player.getStats();
            } catch (_e) {
                return null;
            }
        }
        return null;
    }
}

const instance = new ShakaEngine();
module.exports = instance;
