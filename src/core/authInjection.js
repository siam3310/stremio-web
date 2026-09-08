// Copyright (C) 2017-2023 Smart code 203358507

const DEFAULT_ADDONS = require('./defaultAddons.json');

const sanitizeAndInjectAddons = () => {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }

        // Clear any leftover auto-auth synchronization flags
        try {
            if (window.sessionStorage) {
                window.sessionStorage.removeItem('stremio_auto_auth_synced');
            }
        } catch (_storageErr) {
            // Ignore sessionStorage error
        }

        // Intercept setItem to ensure profile retains custom addons and does not force auto-login
        const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
        window.localStorage.setItem = function(key, value) {
            if (key === 'profile' && typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    if (parsed && typeof parsed === 'object') {
                        // If it has the old hardcoded auth key, clear it
                        if (parsed.auth && parsed.auth.key === 'XrYAehHUiLFE-eK7dl-lyBmUoIeudIQ-p8nZJSd1xMM=') {
                            parsed.auth = null;
                        }
                        if (Array.isArray(parsed.addons)) {
                            // Filter out local files addon
                            const initialLength = parsed.addons.length;
                            parsed.addons = parsed.addons.filter((a) => {
                                const id = a && a.manifest && a.manifest.id;
                                const url = a && a.transportUrl;
                                return id !== 'org.stremio.local' && (!url || (!url.includes('11470') && !url.includes('local-addon')));
                            });
                            let updated = parsed.addons.length !== initialLength;

                            const existingUrls = new Set(parsed.addons.map((a) => a && a.transportUrl));
                            for (const addon of DEFAULT_ADDONS) {
                                if (addon && addon.transportUrl && !existingUrls.has(addon.transportUrl)) {
                                    parsed.addons.push(addon);
                                    existingUrls.add(addon.transportUrl);
                                    updated = true;
                                }
                            }
                            if (updated) {
                                value = JSON.stringify(parsed);
                            }
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

                // If old auto-login was set, remove it
                if (parsed.auth && parsed.auth.key === 'XrYAehHUiLFE-eK7dl-lyBmUoIeudIQ-p8nZJSd1xMM=') {
                    parsed.auth = null;
                }

                // Merge default addons and filter out local addon
                if (parsed.settings && typeof parsed.settings === 'object') {
                    if (Array.isArray(parsed.addons)) {
                        parsed.addons = parsed.addons.filter((a) => {
                            const id = a && a.manifest && a.manifest.id;
                            const url = a && a.transportUrl;
                            return id !== 'org.stremio.local' && (!url || (!url.includes('11470') && !url.includes('local-addon')));
                        });
                        const existingUrls = new Set(parsed.addons.map((a) => a && a.transportUrl));
                        for (const addon of DEFAULT_ADDONS) {
                            if (addon && addon.transportUrl && !existingUrls.has(addon.transportUrl)) {
                                parsed.addons.push(addon);
                                existingUrls.add(addon.transportUrl);
                            }
                        }
                    } else {
                        parsed.addons = [...DEFAULT_ADDONS];
                    }
                    originalSetItem('profile', JSON.stringify(parsed));
                }
            } catch (_err) {
                // Ignore storage error
            }
        }
    } catch (_err) {
        // Ignore storage errors
    }
};

sanitizeAndInjectAddons();

module.exports = {
    DEFAULT_ADDONS,
    sanitizeStorage: sanitizeAndInjectAddons
};
