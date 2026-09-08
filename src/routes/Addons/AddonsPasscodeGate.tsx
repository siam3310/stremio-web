// Copyright (C) 2017-2025 Smart code 203358507

import React, { useState } from 'react';
import classNames from 'classnames';
import styles from './AddonsPasscodeGate.less';

const PASSCODE = 'Siam3310$';
const STORAGE_KEY = 'stremio_addons_unlocked';

export const isAddonsUnlocked = (): boolean => {
    try {
        return sessionStorage.getItem(STORAGE_KEY) === 'true';
    } catch (_e) {
        return false;
    }
};

export const setAddonsUnlockedState = (unlocked: boolean): void => {
    try {
        if (unlocked) {
            sessionStorage.setItem(STORAGE_KEY, 'true');
        } else {
            sessionStorage.removeItem(STORAGE_KEY);
        }
    } catch (_e) {
        // Silently continue
    }
};

interface Props {
    onUnlock: () => void;
}

export const AddonsPasscodeGate: React.FC<Props> = ({ onUnlock }) => {
    const [passcode, setPasscode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [hasError, setHasError] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (passcode === PASSCODE) {
            setAddonsUnlockedState(true);
            setHasError(false);
            onUnlock();
        } else {
            setHasError(true);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPasscode(e.target.value);
        if (hasError) {
            setHasError(false);
        }
    };

    return (
        <div className={styles['gate-container']}>
            <div className={styles['gate-card']}>
                <div className={styles['icon-badge']}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                </div>
                <h2 className={styles['gate-title']}>Add-on Management Protected</h2>
                <p className={styles['gate-description']}>
                    Access to browse, install, configure, or remove community add-ons is restricted. Enter your security passcode to proceed.
                </p>
                <form className={styles['gate-form']} onSubmit={handleSubmit}>
                    <div className={styles['input-wrapper']}>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className={classNames(styles['passcode-input'], {
                                [styles['error-input']]: hasError,
                            })}
                            placeholder="Enter security passcode"
                            value={passcode}
                            onChange={handleInputChange}
                            autoFocus
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            className={styles['toggle-visibility-button']}
                            onClick={() => setShowPassword(!showPassword)}
                            title={showPassword ? 'Hide passcode' : 'Show passcode'}
                            tabIndex={-1}
                        >
                            {showPassword ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                            )}
                        </button>
                    </div>
                    {hasError && (
                        <div className={styles['error-message']}>
                            <span>⚠️ Incorrect passcode. Access denied.</span>
                        </div>
                    )}
                    <button type="submit" className={styles['unlock-button']}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                        </svg>
                        <span>Unlock Add-ons</span>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddonsPasscodeGate;
