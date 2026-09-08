// Copyright (C) 2017-2026 Smart code 203358507
// Firebase Add-on Management Integration

const { initializeApp, getApps, getApp } = require('firebase/app');
const {
    getFirestore,
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    updateDoc,
    serverTimestamp,
} = require('firebase/firestore');

let firebaseApp = null;
let firestoreDb = null;

const getFirebaseDb = () => {
    if (!firestoreDb) {
        try {
            const config = require('../../firebase-applet-config.json');
            firebaseApp = getApps().length > 0 ? getApp() : initializeApp(config);
            firestoreDb = getFirestore(firebaseApp, config.firestoreDatabaseId || undefined);
        } catch (error) {
            console.warn('[FirebaseAddons] Error initializing Firebase client:', error.message);
            throw error;
        }
    }
    return firestoreDb;
};

const encodeDocId = (transportUrl) => {
    try {
        return btoa(transportUrl)
            .replace(/[/+=]/g, '_')
            .slice(0, 100);
    } catch (_e) {
        return encodeURIComponent(transportUrl).replace(/[%._~-]/g, '').slice(0, 100);
    }
};

/**
 * Subscribe to real-time changes of add-ons stored in Firebase Firestore
 */
const subscribeToCloudAddons = (onNext, onError) => {
    try {
        const db = getFirebaseDb();
        const addonsCol = collection(db, 'addons');
        return onSnapshot(
            addonsCol,
            (snapshot) => {
                const list = [];
                snapshot.forEach((d) => {
                    list.push({
                        docId: d.id,
                        ...d.data(),
                    });
                });
                onNext(list);
            },
            (error) => {
                console.warn('[FirebaseAddons] Firestore snapshot error:', error.message);
                if (onError) onError(error);
            }
        );
    } catch (error) {
        console.warn('[FirebaseAddons] subscribeToCloudAddons failed to initialize:', error.message);
        return () => null;
    }
};

/**
 * Save or update an add-on in Firebase Firestore
 */
const saveAddonToCloud = async (addon) => {
    const db = getFirebaseDb();
    const transportUrl = addon.transportUrl || (addon.manifest && addon.manifest.id);
    if (!transportUrl) {
        throw new Error('Addon transportUrl is required');
    }
    const docId = addon.docId || encodeDocId(transportUrl);
    const addonRef = doc(db, 'addons', docId);

    const data = {
        transportUrl: addon.transportUrl,
        transportName: addon.transportName || '',
        name: addon.name || (addon.manifest && addon.manifest.name) || 'Custom Addon',
        version: addon.version || (addon.manifest && addon.manifest.version) || '1.0.0',
        description: addon.description || (addon.manifest && addon.manifest.description) || '',
        logo: addon.logo || (addon.manifest && addon.manifest.logo) || '',
        manifest: addon.manifest || null,
        enabled: addon.enabled !== undefined ? addon.enabled : true,
        updatedAt: serverTimestamp(),
    };

    await setDoc(addonRef, data, { merge: true });
    return { docId, ...data };
};

/**
 * Remove an add-on from Firebase Firestore
 */
const removeAddonFromCloud = async (docId) => {
    const db = getFirebaseDb();
    const addonRef = doc(db, 'addons', docId);
    await deleteDoc(addonRef);
};

/**
 * Toggle add-on enabled state in Firebase Firestore
 */
const toggleAddonInCloud = async (docId, enabled) => {
    const db = getFirebaseDb();
    const addonRef = doc(db, 'addons', docId);
    await updateDoc(addonRef, {
        enabled: Boolean(enabled),
        updatedAt: serverTimestamp(),
    });
};

/**
 * Fetch an add-on's remote manifest.json and save it directly to Firestore
 */
const importAddonByUrl = async (url) => {
    const trimmed = url.trim();
    const manifestUrl = trimmed.endsWith('/manifest.json') ? trimmed : `${trimmed.replace(/\/$/, '')}/manifest.json`;

    const res = await fetch(manifestUrl);
    if (!res.ok) {
        throw new Error(`Failed to fetch manifest (${res.status} ${res.statusText})`);
    }
    const manifest = await res.json();
    if (!manifest || !manifest.id || !manifest.name) {
        throw new Error('Invalid manifest received: missing id or name');
    }

    return await saveAddonToCloud({
        transportUrl: manifestUrl,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        logo: manifest.logo,
        manifest,
        enabled: true,
    });
};

/**
 * Seed or verify Fibwatch in Firebase Firestore
 */
const ensureFibwatchInCloud = async () => {
    try {
        const fibwatchUrl = 'https://siam3310-fib.lovable.app/api/public/stremio/manifest.json';
        await importAddonByUrl(fibwatchUrl);
    } catch (e) {
        console.warn('[FirebaseAddons] Error ensuring Fibwatch in cloud:', e.message);
    }
};

/**
 * Backup all locally installed addons to Firebase Firestore
 */
const backupLocalAddonsToCloud = async (addonsList) => {
    if (!Array.isArray(addonsList)) return 0;
    let count = 0;
    for (const addon of addonsList) {
        if (!addon || !addon.transportUrl) continue;
        if (addon.transportUrl.includes('11470') || (addon.manifest && addon.manifest.id === 'org.stremio.local')) continue;
        try {
            await saveAddonToCloud({
                transportUrl: addon.transportUrl,
                name: (addon.manifest && addon.manifest.name) || 'Addon',
                version: (addon.manifest && addon.manifest.version) || '1.0.0',
                description: (addon.manifest && addon.manifest.description) || '',
                logo: (addon.manifest && addon.manifest.logo) || '',
                manifest: addon.manifest,
                enabled: true,
            });
            count += 1;
        } catch (_e) {
            // Ignore single item failures during bulk backup
        }
    }
    return count;
};

/**
 * Synchronize all cloud-enabled add-ons into Stremio's Core dispatcher
 */
const syncCloudAddonsToCore = (cloudAddons, core) => {
    if (!core || !core.transport || !Array.isArray(cloudAddons)) return;

    for (const item of cloudAddons) {
        if (!item.transportUrl || !item.manifest) continue;
        if (item.enabled) {
            core.transport.dispatch({
                action: 'Ctx',
                args: {
                    action: 'InstallAddon',
                    args: {
                        transportUrl: item.transportUrl,
                        transportName: item.transportName || '',
                        manifest: item.manifest,
                        flags: { official: false, protected: false },
                    },
                },
            });
        }
    }
};

module.exports = {
    getFirebaseDb,
    subscribeToCloudAddons,
    saveAddonToCloud,
    removeAddonFromCloud,
    toggleAddonInCloud,
    importAddonByUrl,
    ensureFibwatchInCloud,
    backupLocalAddonsToCloud,
    syncCloudAddonsToCore,
};
