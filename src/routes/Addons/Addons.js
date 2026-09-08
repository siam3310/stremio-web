// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useParams } = require('react-router');
const { useSearchParams } = require('react-router-dom');
const classnames = require('classnames');
const { useTranslation } = require('react-i18next');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { useCore } = require('stremio/core');
const { usePlatform, useBinaryState, withCoreSuspender } = require('stremio/common');
const { AddonDetailsModal, Button, Image, MainNavBars, ModalDialog, SearchBar, SharePrompt, TextInput, MultiselectMenu } = require('stremio/components');
const useToast = require('stremio/common/Toast/useToast');
const Addon = require('./Addon');
const useInstalledAddons = require('./useInstalledAddons');
const useRemoteAddons = require('./useRemoteAddons');
const useAddonDetailsTransportUrl = require('./useAddonDetailsTransportUrl');
const useSelectableInputs = require('./useSelectableInputs');
const styles = require('./styles');
const { AddonPlaceholder } = require('./AddonPlaceholder');
const { default: AddonsPasscodeGate, isAddonsUnlocked, setAddonsUnlockedState } = require('./AddonsPasscodeGate');
const { FirebaseAddonsModal } = require('./FirebaseAddonsModal');

const Addons = () => {
    const [unlocked, setUnlocked] = React.useState(() => isAddonsUnlocked());
    const { type, transportUrl, catalogId } = useParams();
    const [queryParams] = useSearchParams();
    const urlParams = React.useMemo(() => ({
        type,
        transportUrl,
        catalogId
    }), [type, transportUrl, catalogId]);
    const { t } = useTranslation();
    const platform = usePlatform();
    const core = useCore();
    const toast = useToast();
    const installedAddons = useInstalledAddons(urlParams);
    const remoteAddons = useRemoteAddons(urlParams);
    const [addonDetailsTransportUrl, setAddonDetailsTransportUrl] = useAddonDetailsTransportUrl(urlParams);
    const selectInputs = useSelectableInputs(installedAddons, remoteAddons);
    const [filtersModalOpen, openFiltersModal, closeFiltersModal] = useBinaryState(false);
    const [addAddonModalOpen, openAddAddonModal, closeAddAddonModal] = useBinaryState(false);
    const [firebaseModalOpen, openFirebaseModal, closeFirebaseModal] = useBinaryState(false);
    const addAddonUrlInputRef = React.useRef(null);
    const addAddonOnSubmit = React.useCallback(() => {
        if (addAddonUrlInputRef.current !== null) {
            try {
                let url = new URL(addAddonUrlInputRef.current.value).toString();
                setAddonDetailsTransportUrl(url);
            } catch (e) {
                toast.show({
                    type: 'error',
                    title: `Failed to parse addon url: ${addAddonUrlInputRef.current.value}`,
                    timeout: 10000
                });
                console.error('Failed to parse addon url:', e);
            }
        }
    }, [setAddonDetailsTransportUrl]);
    const addAddonModalButtons = React.useMemo(() => {
        return [
            {
                className: styles['cancel-button'],
                label: t('BUTTON_CANCEL'),
                props: {
                    onClick: closeAddAddonModal
                }
            },
            {
                label: t('ADDON_ADD'),
                props: {
                    onClick: addAddonOnSubmit
                }
            }
        ];
    }, [addAddonOnSubmit]);
    const [search, setSearch] = React.useState('');
    const searchInputOnChange = React.useCallback((event) => {
        setSearch(event.currentTarget.value);
    }, []);
    const [sharedAddon, setSharedAddon] = React.useState(null);
    const clearSharedAddon = React.useCallback(() => {
        setSharedAddon(null);
    }, []);
    const onAddonShare = React.useCallback((event) => {
        setSharedAddon(event.dataset.addon);
    }, []);
    const onAddonInstall = React.useCallback((event) => {
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'InstallAddon',
                args: event.dataset.addon,
            }
        });
    }, []);
    const onAddonUninstall = React.useCallback((event) => {
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'UninstallAddon',
                args: event.dataset.addon,
            }
        });
    }, []);
    const onAddonConfigure = React.useCallback((event) => {
        platform.openExternal(event.dataset.addon.transportUrl.replace('manifest.json', 'configure'));
    }, []);
    const onAddonOpen = React.useCallback((event) => {
        setAddonDetailsTransportUrl(event.dataset.addon.transportUrl);
    }, [setAddonDetailsTransportUrl]);
    const closeAddonDetails = React.useCallback(() => {
        setAddonDetailsTransportUrl(null);
    }, [setAddonDetailsTransportUrl]);
    const searchFilterPredicate = React.useCallback((addon) => {
        return search.length === 0 ||
            (
                (typeof addon.manifest.name === 'string' && addon.manifest.name.toLowerCase().includes(search.toLowerCase())) ||
                (typeof addon.manifest.description === 'string' && addon.manifest.description.toLowerCase().includes(search.toLowerCase()))
            );
    }, [search]);
    const renderLogoFallback = React.useCallback(() => (
        <Icon className={styles['icon']} name={'addons'} />
    ), []);
    React.useLayoutEffect(() => {
        closeAddAddonModal();
        setSearch('');
        clearSharedAddon();
    }, [urlParams, queryParams]);

    if (!unlocked) {
        return (
            <MainNavBars className={styles['addons-container']} route={'addons'}>
                <AddonsPasscodeGate onUnlock={() => setUnlocked(true)} />
            </MainNavBars>
        );
    }

    return (
        <MainNavBars className={styles['addons-container']} route={'addons'}>
            <div className={styles['addons-content']}>
                <div className={styles['selectable-inputs-container']}>
                    {selectInputs.map((selectInput, index) => (
                        <MultiselectMenu
                            {...selectInput}
                            key={index}
                            className={styles['select-input-container']}
                        />
                    ))}
                    <div className={styles['spacing']} />
                    <Button
                        className={styles['add-button-container']}
                        title={'Lock Add-on Management'}
                        onClick={() => {
                            setAddonsUnlockedState(false);
                            setUnlocked(false);
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <div className={styles['add-button-label']}>Lock</div>
                    </Button>
                    <Button
                        className={styles['add-button-container']}
                        title={'Firebase Cloud Add-on Manager'}
                        onClick={openFirebaseModal}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffca28" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                        <div className={styles['add-button-label']}>Firebase Sync</div>
                    </Button>
                    <Button className={styles['add-button-container']} title={t('ADD_ADDON')} onClick={openAddAddonModal}>
                        <Icon className={styles['icon']} name={'add'} />
                        <div className={styles['add-button-label']}>{t('ADD_ADDON')}</div>
                    </Button>
                    <SearchBar
                        className={styles['search-bar']}
                        title={t('ADDON_SEARCH')}
                        value={search}
                        onChange={searchInputOnChange}
                    />
                    <Button className={styles['filter-button']} title={t('ALL_FILTERS')} onClick={openFiltersModal}>
                        <Icon className={styles['filter-icon']} name={'filters'} />
                    </Button>
                </div>
                {
                    installedAddons.selected !== null ?
                        installedAddons.selectable.types.length === 0 ?
                            <div className={styles['message-container']}>
                                {t('NO_ADDONS')}
                            </div>
                            :
                            installedAddons.catalog.length === 0 ?
                                <div className={styles['message-container']}>
                                    {t('NO_ADDONS_FOR_TYPE')}
                                </div>
                                :
                                <div className={styles['addons-list-container']}>
                                    {
                                        installedAddons.catalog
                                            .filter(searchFilterPredicate)
                                            .map((addon, index) => (
                                                <Addon
                                                    key={index}
                                                    className={classnames(styles['addon'], 'animation-fade-in')}
                                                    id={addon.manifest.id}
                                                    name={addon.manifest.name}
                                                    version={addon.manifest.version}
                                                    logo={addon.manifest.logo}
                                                    description={addon.manifest.description}
                                                    types={addon.manifest.types}
                                                    behaviorHints={addon.manifest.behaviorHints}
                                                    installed={addon.installed}
                                                    onInstall={onAddonInstall}
                                                    onUninstall={onAddonUninstall}
                                                    onConfigure={onAddonConfigure}
                                                    onOpen={onAddonOpen}
                                                    onShare={onAddonShare}
                                                    dataset={{ addon }}
                                                />
                                            ))
                                    }
                                </div>
                        :
                        remoteAddons.selected !== null ?
                            remoteAddons.catalog.content.type === 'Err' ?
                                <div className={styles['message-container']}>
                                    {remoteAddons.catalog.content.content}
                                </div>
                                :
                                remoteAddons.catalog.content.type === 'Loading' ?
                                    <div className={styles['addons-list-container']}>
                                        {Array.from({ length: 6 }).map((_, index) => (
                                            <AddonPlaceholder key={index} className={styles['addon']} />
                                        ))}
                                    </div>
                                    :
                                    <div className={styles['addons-list-container']}>
                                        {
                                            remoteAddons.catalog.content.content
                                                .filter(searchFilterPredicate)
                                                .map((addon, index) => (
                                                    <Addon
                                                        key={index}
                                                        className={classnames(styles['addon'], 'animation-fade-in')}
                                                        id={addon.manifest.id}
                                                        name={addon.manifest.name}
                                                        version={addon.manifest.version}
                                                        logo={addon.manifest.logo}
                                                        description={addon.manifest.description}
                                                        types={addon.manifest.types}
                                                        behaviorHints={addon.manifest.behaviorHints}
                                                        installed={addon.installed}
                                                        onInstall={onAddonInstall}
                                                        onUninstall={onAddonUninstall}
                                                        onConfigure={onAddonConfigure}
                                                        onOpen={onAddonOpen}
                                                        onShare={onAddonShare}
                                                        dataset={{ addon }}
                                                    />
                                                ))
                                        }
                                    </div>
                            :
                            <div className={styles['addons-list-container']}>
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <AddonPlaceholder key={index} className={styles['addon']} />
                                ))}
                            </div>
                }
            </div>
            {
                filtersModalOpen ?
                    <ModalDialog title={t('ADDONS_FILTERS')} className={styles['filters-modal']} onCloseRequest={closeFiltersModal}>
                        {selectInputs.map((selectInput, index) => (
                            <MultiselectMenu
                                {...selectInput}
                                key={index}
                                className={styles['select-input-container']}
                            />
                        ))}
                    </ModalDialog>
                    :
                    null
            }
            {
                addAddonModalOpen ?
                    <ModalDialog
                        className={styles['add-addon-modal-container']}
                        title={t('ADD_ADDON')}
                        buttons={addAddonModalButtons}
                        onCloseRequest={closeAddAddonModal}>
                        <div className={styles['notice']}>{t('ADD_ADDON_DESCRIPTION')}</div>
                        <TextInput
                            ref={addAddonUrlInputRef}
                            className={styles['addon-url-input']}
                            type={'text'}
                            placeholder={t('PASTE_ADDON_URL')}
                            autoFocus={true}
                            onSubmit={addAddonOnSubmit}
                        />
                    </ModalDialog>
                    :
                    null
            }
            {
                sharedAddon !== null ?
                    <ModalDialog
                        className={styles['share-modal-container']}
                        title={t('SHARE_ADDON')}
                        onCloseRequest={clearSharedAddon}>
                        <div className={styles['title-container']}>
                            <Image
                                className={styles['logo']}
                                src={sharedAddon.manifest.logo}
                                alt={' '}
                                renderFallback={renderLogoFallback}
                            />
                            <div className={styles['name-container']}>
                                <span className={styles['name']}>{typeof sharedAddon.manifest.name === 'string' && sharedAddon.manifest.name.length > 0 ? sharedAddon.manifest.name : sharedAddon.manifest.id}</span>
                                {
                                    typeof sharedAddon.manifest.version === 'string' && sharedAddon.manifest.version.length > 0 ?
                                        <span className={styles['version']}>{t('ADDON_VERSION_SHORT', { version: sharedAddon.manifest.version })}</span>
                                        :
                                        null
                                }
                            </div>
                        </div>
                        <SharePrompt
                            className={styles['share-prompt-container']}
                            url={sharedAddon.transportUrl}
                        />
                    </ModalDialog>
                    :
                    null
            }
            {
                typeof addonDetailsTransportUrl === 'string' ?
                    <AddonDetailsModal
                        transportUrl={addonDetailsTransportUrl}
                        onCloseRequest={closeAddonDetails}
                    />
                    :
                    null
            }
            <FirebaseAddonsModal
                isOpen={firebaseModalOpen}
                onClose={closeFirebaseModal}
                installedAddonsList={installedAddons.catalog}
            />
        </MainNavBars>
    );
};

const AddonsFallback = () => (
    <MainNavBars className={styles['addons-container']} route={'addons'} />
);

module.exports = withCoreSuspender(Addons, AddonsFallback);
