// Copyright (C) 2017-2023 Smart code 203358507

const AUTH_KEY = process.env.REACT_APP_STREMIO_AUTH_KEY || 'XrYAehHUiLFE-eK7dl-lyBmUoIeudIQ-p8nZJSd1xMM=';

const sanitizeStorage = () => {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }

        // Clean up any legacy or malformed profile in localStorage to prevent serde deserialization failure
        const rawProfile = window.localStorage.getItem('profile');
        if (rawProfile) {
            try {
                const parsed = JSON.parse(rawProfile);
                if (!parsed || typeof parsed !== 'object') {
                    window.localStorage.removeItem('profile');
                    return;
                }

                // In stremio-core-web, struct Auth requires key (string) and user with _id, lastModified, and dateRegistered.
                // If auth is present but missing any of these required fields, the Rust serde deserializer panics.
                if (parsed.auth) {
                    const user = parsed.auth.user;
                    if (
                        typeof parsed.auth !== 'object' ||
                        typeof parsed.auth.key !== 'string' ||
                        !user ||
                        typeof user !== 'object' ||
                        !user._id ||
                        !user.lastModified ||
                        !user.dateRegistered
                    ) {
                        console.warn('Removing malformed profile auth from localStorage to prevent serialization error');
                        window.localStorage.removeItem('profile');
                    }
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
