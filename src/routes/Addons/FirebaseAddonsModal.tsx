// Copyright (C) 2017-2026 Smart code 203358507

import React, { useState, useEffect, useCallback } from 'react';
// @ts-expect-error stremio components
import { ModalDialog } from 'stremio/components';
// @ts-expect-error stremio common
import useToast from 'stremio/common/Toast/useToast';
// @ts-expect-error stremio core
import { useCore } from 'stremio/core';
// @ts-expect-error internal core module
import {
    subscribeToCloudAddons,
    removeAddonFromCloud,
    toggleAddonInCloud,
    importAddonByUrl,
    ensureFibwatchInCloud,
    backupLocalAddonsToCloud,
    syncCloudAddonsToCore,
} from '../../core/firebaseAddons';
import styles from './FirebaseAddonsModal.less';

interface CloudAddon {
    docId: string;
    transportUrl: string;
    name: string;
    version: string;
    description?: string;
    logo?: string;
    manifest?: any;
    enabled?: boolean;
}

interface FirebaseAddonsModalProps {
    isOpen: boolean;
    onClose: () => void;
    installedAddonsList?: any[];
}

export const FirebaseAddonsModal: React.FC<FirebaseAddonsModalProps> = ({
    isOpen,
    onClose,
    installedAddonsList = [],
}) => {
    const core = useCore();
    const toast = useToast();
    const [cloudAddons, setCloudAddons] = useState<CloudAddon[]>([]);
    const [manifestUrlInput, setManifestUrlInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const FIBWATCH_URL = 'https://siam3310-fib.lovable.app/api/public/stremio/manifest.json';

    // Subscribe to Firestore changes
    useEffect(() => {
        if (!isOpen) return;

        const unsubscribe = subscribeToCloudAddons((list: CloudAddon[]) => {
            setCloudAddons(list);
        });

        // Ensure Fibwatch exists in Cloud on modal opening
        ensureFibwatchInCloud().catch(() => null);

        return () => {
            unsubscribe();
        };
    }, [isOpen]);

    const handleImportAddon = useCallback(async (urlToImport?: string) => {
        const url = (urlToImport || manifestUrlInput).trim();
        if (!url) {
            toast.show({
                type: 'error',
                title: 'Please provide an add-on manifest URL',
                timeout: 4000,
            });
            return;
        }

        setLoading(true);
        try {
            const added = await importAddonByUrl(url);
            // Also install directly into current Stremio session
            if (added.manifest) {
                core.transport.dispatch({
                    action: 'Ctx',
                    args: {
                        action: 'InstallAddon',
                        args: {
                            transportUrl: added.transportUrl,
                            transportName: '',
                            manifest: added.manifest,
                            flags: { official: false, protected: false },
                        },
                    },
                });
            }
            toast.show({
                type: 'success',
                title: `Successfully added ${added.name} to Firebase & Stremio!`,
                timeout: 5000,
            });
            setManifestUrlInput('');
        } catch (err: any) {
            toast.show({
                type: 'error',
                title: `Failed to import add-on: ${err.message || 'Unknown error'}`,
                timeout: 6000,
            });
        } finally {
            setLoading(false);
        }
    }, [manifestUrlInput, core, toast]);

    const handleSyncAllToStremio = useCallback(() => {
        setSyncing(true);
        try {
            syncCloudAddonsToCore(cloudAddons, core);
            toast.show({
                type: 'success',
                title: `Synchronized ${cloudAddons.length} cloud add-ons with Stremio!`,
                timeout: 4000,
            });
        } catch (err: any) {
            toast.show({
                type: 'error',
                title: `Sync failed: ${err.message}`,
                timeout: 4000,
            });
        } finally {
            setSyncing(false);
        }
    }, [cloudAddons, core, toast]);

    const handleBackupInstalled = useCallback(async () => {
        setLoading(true);
        try {
            const count = await backupLocalAddonsToCloud(installedAddonsList);
            toast.show({
                type: 'success',
                title: `Backed up ${count} add-on(s) to Firebase Firestore!`,
                timeout: 4000,
            });
        } catch (err: any) {
            toast.show({
                type: 'error',
                title: `Backup error: ${err.message}`,
                timeout: 4000,
            });
        } finally {
            setLoading(false);
        }
    }, [installedAddonsList, toast]);

    const handleToggle = useCallback(async (docId: string, currentEnabled: boolean) => {
        try {
            await toggleAddonInCloud(docId, !currentEnabled);
        } catch (err: any) {
            toast.show({
                type: 'error',
                title: `Failed to update status: ${err.message}`,
                timeout: 4000,
            });
        }
    }, [toast]);

    const handleDelete = useCallback(async (docId: string, name: string) => {
        try {
            await removeAddonFromCloud(docId);
            toast.show({
                type: 'success',
                title: `Removed ${name} from Firebase`,
                timeout: 3000,
            });
        } catch (err: any) {
            toast.show({
                type: 'error',
                title: `Failed to remove: ${err.message}`,
                timeout: 4000,
            });
        }
    }, [toast]);

    const handleSingleSync = useCallback((addon: CloudAddon) => {
        if (!addon.manifest || !addon.transportUrl) return;
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'InstallAddon',
                args: {
                    transportUrl: addon.transportUrl,
                    transportName: '',
                    manifest: addon.manifest,
                    flags: { official: false, protected: false },
                },
            },
        });
        toast.show({
            type: 'success',
            title: `Installed ${addon.name} into Stremio session`,
            timeout: 3000,
        });
    }, [core, toast]);

    if (!isOpen) return null;

    const modalButtons = [
        {
            label: 'Close',
            props: {
                onClick: onClose,
            },
        },
    ];

    return (
        <ModalDialog
            className={styles['firebase-modal-container']}
            title="Firebase Cloud Add-on Manager"
            buttons={modalButtons}
            onCloseRequest={onClose}
        >
            <div className={styles['modal-content-wrapper']}>
                {/* Firebase Connection Status Banner */}
                <div className={styles['firebase-status-banner']}>
                    <div className={styles['status-left']}>
                        <div className={styles['status-dot']} />
                        <div className={styles['status-text']}>
                            <span className={styles['status-title']}>Firebase Firestore Cloud Connected</span>
                            <span className={styles['status-sub']}>Project: primordial-might-z8kj5 • Real-time synchronization active</span>
                        </div>
                    </div>
                    <span className={styles['status-badge']}>Live Sync</span>
                </div>

                {/* Main Action Buttons */}
                <div className={styles['actions-bar']}>
                    <button
                        type="button"
                        className={`${styles['action-btn']} ${styles['primary']}`}
                        onClick={handleSyncAllToStremio}
                        disabled={syncing}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                        </svg>
                        <span>{syncing ? 'Syncing...' : 'Sync Cloud Add-ons to Stremio'}</span>
                    </button>

                    <button
                        type="button"
                        className={styles['action-btn']}
                        onClick={handleBackupInstalled}
                        disabled={loading}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" />
                            <polyline points="7 3 7 8 15 8" />
                        </svg>
                        <span>Backup Stremio Add-ons to Firebase</span>
                    </button>

                    <button
                        type="button"
                        className={styles['action-btn']}
                        onClick={() => handleImportAddon(FIBWATCH_URL)}
                        disabled={loading}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        <span>Update / Seed Fibwatch</span>
                    </button>
                </div>

                {/* Import New Add-on Section */}
                <div className={styles['import-section']}>
                    <div className={styles['section-header']}>Add New Add-on to Firebase Cloud</div>
                    <div className={styles['input-row']}>
                        <input
                            type="text"
                            className={styles['manifest-input']}
                            placeholder="Enter add-on manifest URL (https://.../manifest.json)"
                            value={manifestUrlInput}
                            onChange={(e) => setManifestUrlInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleImportAddon();
                            }}
                        />
                        <button
                            type="button"
                            className={styles['add-btn']}
                            onClick={() => handleImportAddon()}
                            disabled={loading || !manifestUrlInput.trim()}
                        >
                            {loading ? 'Adding...' : 'Add to Cloud'}
                        </button>
                    </div>

                    <div className={styles['quick-chips']}>
                        <span>Quick Add:</span>
                        <button
                            type="button"
                            className={styles['chip-btn']}
                            onClick={() => {
                                setManifestUrlInput(FIBWATCH_URL);
                                handleImportAddon(FIBWATCH_URL);
                            }}
                        >
                            Fibwatch Add-on ({FIBWATCH_URL.slice(0, 36)}...)
                        </button>
                    </div>
                </div>

                {/* Cloud-Managed Add-ons List */}
                <div className={styles['cloud-addons-list']}>
                    <div className={styles['list-header']}>
                        <span>Cloud-Managed Add-ons</span>
                        <span className={styles['count']}>
                            {cloudAddons.length} {cloudAddons.length === 1 ? 'add-on' : 'add-ons'} stored in Firestore
                        </span>
                    </div>

                    {cloudAddons.length === 0 ? (
                        <div className={styles['empty-state']}>
                            No cloud add-ons yet. Click &quot;Update / Seed Fibwatch&quot; or paste a manifest URL above to save add-ons to Firebase.
                        </div>
                    ) : (
                        cloudAddons.map((addon) => (
                            <div key={addon.docId} className={styles['addon-item-card']}>
                                <div className={styles['addon-info']}>
                                    <img
                                        className={styles['addon-logo']}
                                        src={addon.logo || 'https://placehold.co/44x44/12100f/f5b93a/png?text=FW'}
                                        alt={addon.name}
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/44x44/12100f/f5b93a/png?text=FW';
                                        }}
                                    />
                                    <div className={styles['addon-details']}>
                                        <div className={styles['addon-name-row']}>
                                            <span className={styles['addon-title']}>{addon.name}</span>
                                            <span className={styles['addon-ver']}>v{addon.version || '1.0.0'}</span>
                                        </div>
                                        {addon.description && (
                                            <div className={styles['addon-desc']}>{addon.description}</div>
                                        )}
                                        <div className={styles['addon-url']}>{addon.transportUrl}</div>
                                    </div>
                                </div>

                                <div className={styles['addon-controls']}>
                                    <button
                                        type="button"
                                        className={`${styles['control-btn']} ${styles['sync-single']}`}
                                        title="Install or sync this add-on into Stremio"
                                        onClick={() => handleSingleSync(addon)}
                                    >
                                        Install / Sync
                                    </button>
                                    <button
                                        type="button"
                                        className={styles['control-btn']}
                                        title="Toggle enable/disable"
                                        onClick={() => handleToggle(addon.docId, addon.enabled !== false)}
                                    >
                                        {addon.enabled !== false ? 'Enabled' : 'Disabled'}
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles['control-btn']} ${styles['delete']}`}
                                        title="Remove add-on from Firebase Firestore"
                                        onClick={() => handleDelete(addon.docId, addon.name)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </ModalDialog>
    );
};

export default FirebaseAddonsModal;
