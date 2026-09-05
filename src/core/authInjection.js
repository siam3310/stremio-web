// Copyright (C) 2017-2023 Smart code 203358507

const AUTH_KEY = process.env.REACT_APP_STREMIO_AUTH_KEY || 'XrYAehHUiLFE-eK7dl-lyBmUoIeudIQ-p8nZJSd1xMM=';

const sanitizeStorage = () => {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }

        // Clean up any legacy or malformed profile in localStorage that lacks lastModified
        // to prevent serde deserialization failure in stremio-core-web
        const rawProfile = window.localStorage.getItem('profile');
        if (rawProfile) {
            try {
                const parsed = JSON.parse(rawProfile);
                if (parsed && ((parsed.auth && parsed.auth.user && !parsed.auth.user.lastModified) || (!parsed.settings && !parsed.addons))) {
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

sanitizeStorage();

module.exports = {
    AUTH_KEY,
    sanitizeStorage
};
