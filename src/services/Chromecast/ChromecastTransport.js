// Copyright (C) 2017-2023 Smart code 203358507

const EventEmitter = require('eventemitter3');

function ChromecastTransport() {
    EventEmitter.call(this);

    let initialized = false;

    const onInit = () => {
        if (initialized) return;
        try {
            const context = window.cast && window.cast.framework ? window.cast.framework.CastContext.getInstance() : null;
            if (!context) {
                this.emit('init-error', new Error('window.cast api not available'));
                return;
            }

            initialized = true;

            context.addEventListener(
                window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
                (event) => {
                    this.emit(window.cast.framework.CastContextEventType.CAST_STATE_CHANGED, event);
                    this.emit('stateChanged', event);
                }
            );

            context.addEventListener(
                window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
                (event) => {
                    const session = context.getCurrentSession();
                    if (session && event.sessionState === window.cast.framework.SessionState.SESSION_STARTED) {
                        try {
                            session.addMessageListener('urn:x-cast:com.stremio', (namespace, message) => {
                                try {
                                    const parsed = typeof message === 'string' ? JSON.parse(message) : message;
                                    this.emit('message', parsed);
                                } catch (e) {
                                    this.emit('message-error', e);
                                }
                            });
                        } catch (err) {
                            this.emit('message-error', err);
                        }
                    }
                    this.emit(window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED, event);
                }
            );

            this.emit('init');
        } catch (error) {
            this.emit('init-error', error);
        }
    };

    if (window.cast && window.cast.framework) {
        setTimeout(onInit, 0);
    } else {
        const previousOnGCastApiAvailable = window.__onGCastApiAvailable;
        window.__onGCastApiAvailable = (isAvailable) => {
            if (typeof previousOnGCastApiAvailable === 'function') {
                previousOnGCastApiAvailable(isAvailable);
            }
            if (isAvailable) {
                onInit();
            } else {
                this.emit('init-error', new Error('window.cast api not available'));
            }
        };

        setTimeout(() => {
            if (!initialized && (!window.cast || !window.cast.framework)) {
                this.emit('init-error', new Error('window.cast api not available'));
            }
        }, 5000);
    }
}

ChromecastTransport.prototype = Object.create(EventEmitter.prototype);
ChromecastTransport.prototype.constructor = ChromecastTransport;

ChromecastTransport.prototype.setOptions = function(options) {
    if (window.cast && window.cast.framework) {
        window.cast.framework.CastContext.getInstance().setOptions(options);
    }
};

ChromecastTransport.prototype.getCastState = function() {
    if (window.cast && window.cast.framework) {
        return window.cast.framework.CastContext.getInstance().getCastState();
    }
    return 'NO_DEVICES_AVAILABLE';
};

ChromecastTransport.prototype.getCastDevice = function() {
    try {
        const session = window.cast && window.cast.framework ? window.cast.framework.CastContext.getInstance().getCurrentSession() : null;
        return session ? session.getCastDevice() : null;
    } catch {
        return null;
    }
};

ChromecastTransport.prototype.requestSession = function() {
    if (window.cast && window.cast.framework) {
        return window.cast.framework.CastContext.getInstance().requestSession();
    }
    return Promise.reject(new Error('Cast context not available'));
};

ChromecastTransport.prototype.sendMessage = function(message) {
    try {
        const session = window.cast && window.cast.framework ? window.cast.framework.CastContext.getInstance().getCurrentSession() : null;
        if (session) {
            const payload = typeof message === 'string' ? message : JSON.stringify(message);
            return session.sendMessage('urn:x-cast:com.stremio', payload);
        }
        return Promise.reject(new Error('No active cast session'));
    } catch (err) {
        return Promise.reject(err);
    }
};

module.exports = ChromecastTransport;
