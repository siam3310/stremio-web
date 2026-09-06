// Copyright (C) 2017-2023 Smart code 203358507

const AUTH_KEY = process.env.REACT_APP_STREMIO_AUTH_KEY || 'XrYAehHUiLFE-eK7dl-lyBmUoIeudIQ-p8nZJSd1xMM=';

const DEFAULT_AUTH = {
    key: AUTH_KEY,
    user: {
        _id: '695fbfb398cbf52fb5cab1cc',
        email: 'mahamudunn1005@gmail.com',
        fbId: null,
        appleId: null,
        avatar: null,
        lastModified: '2026-09-02T11:18:42.687Z',
        dateRegistered: '2026-01-08T14:31:15.693Z',
        trakt: {
            created_at: 1788347922,
            expires_in: 604800,
            access_token: 'gDmpaJbUMmJJEYVebuCtNCjpIRlddizE',
            refresh_token: 'ETygUsWTWQkllmvIDyEgnpuLmqFbKfFl'
        },
        premium_expire: null,
        gdpr_consent: {
            marketing: true,
            privacy: true,
            tos: true,
            from: 'app'
        }
    }
};

const sanitizeAndInjectAuth = () => {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }

        // Intercept setItem to ensure profile always retains valid auth
        const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
        window.localStorage.setItem = function(key, value) {
            if (key === 'profile' && typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    if (parsed && typeof parsed === 'object' && parsed.settings) {
                        if (!parsed.auth || !parsed.auth.key) {
                            parsed.auth = DEFAULT_AUTH;
                            value = JSON.stringify(parsed);
                        }
                    }
                } catch (_err) {
                    // Ignore JSON parse error
                }
            }
            return originalSetItem(key, value);
        };

        const rawProfile = window.localStorage.getItem('profile');
        if (rawProfile) {
            try {
                const parsed = JSON.parse(rawProfile);
                if (!parsed || typeof parsed !== 'object') {
                    window.localStorage.removeItem('profile');
                    return;
                }

                // If profile has valid settings, inject or validate default auth
                if (parsed.settings && typeof parsed.settings === 'object') {
                    if (!parsed.auth || !parsed.auth.key) {
                        parsed.auth = DEFAULT_AUTH;
                    } else {
                        // Ensure all serde-required fields are intact to avoid deserialization panics
                        parsed.auth.key = parsed.auth.key || DEFAULT_AUTH.key;
                        if (!parsed.auth.user || typeof parsed.auth.user !== 'object') {
                            parsed.auth.user = DEFAULT_AUTH.user;
                        } else {
                            parsed.auth.user._id = parsed.auth.user._id || DEFAULT_AUTH.user._id;
                            parsed.auth.user.email = parsed.auth.user.email || DEFAULT_AUTH.user.email;
                            parsed.auth.user.lastModified = parsed.auth.user.lastModified || DEFAULT_AUTH.user.lastModified;
                            parsed.auth.user.dateRegistered = parsed.auth.user.dateRegistered || DEFAULT_AUTH.user.dateRegistered;
                            parsed.auth.user.gdpr_consent = parsed.auth.user.gdpr_consent || DEFAULT_AUTH.user.gdpr_consent;
                        }
                    }
                    originalSetItem('profile', JSON.stringify(parsed));
                } else {
                    // Incomplete profile without settings; remove to allow clean regeneration by WASM core
                    window.localStorage.removeItem('profile');
                }
            } catch (_err) {
                window.localStorage.removeItem('profile');
            }
        }
    } catch (_err) {
        // Ignore storage errors
    }
};

sanitizeAndInjectAuth();

module.exports = {
    AUTH_KEY,
    DEFAULT_AUTH,
    sanitizeStorage: sanitizeAndInjectAuth
};

