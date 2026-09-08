// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { useTranslation } = require('react-i18next');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { Button } = require('stremio/components');
const { useFullscreen } = require('stremio/common/Fullscreen');
const useProfile = require('stremio/common/useProfile');
const usePWA = require('stremio/common/usePWA');
const { default: usePlayUrl } = require('stremio/common/usePlayUrl');
const useToast = require('stremio/common/Toast/useToast');
const { withCoreSuspender } = require('stremio/common/CoreSuspender');
const styles = require('./styles');

const NavMenuContent = ({ onClick }) => {
    const { t } = useTranslation();
    const profile = useProfile();
    const { handlePlayUrl } = usePlayUrl();
    const toast = useToast();
    const [fullscreen, requestFullscreen, exitFullscreen, , supported] = useFullscreen();
    const [, isAndroidPWA] = usePWA();
    const streamingServerWarningDismissed = true;
    const onPlayMagnetLinkClick = React.useCallback(async () => {
        try {
            const clipboardText = await navigator.clipboard.readText();
            const handled = await handlePlayUrl(clipboardText);
            if (!handled) {
                toast.show({
                    type: 'error',
                    title: 'Clipboard does not contain a valid HTTP/HTTPS or HLS stream URL.',
                    timeout: 5000
                });
            }
        } catch(e) {
            console.error(e);
        }
    }, [handlePlayUrl]);

    return (
        <div className={classnames(styles['nav-menu-container'], 'animation-fade-in', { [styles['with-warning']]: !streamingServerWarningDismissed } )} onClick={onClick}>
            <div className={styles['user-info-container']}>
                <div
                    className={styles['avatar-container']}
                    style={{
                        backgroundImage: profile.auth === null ?
                            `url('${require('/assets/images/anonymous.png')}')`
                            :
                            profile.auth.user.avatar ?
                                `url('${profile.auth.user.avatar}')`
                                :
                                `url('${require('/assets/images/default_avatar.png')}')`
                    }}
                />
                <div className={styles['user-info-details']}>
                    <div className={styles['email-container']}>
                        <div className={styles['email-label']}>{t('ANONYMOUS_USER')}</div>
                    </div>
                </div>
            </div>
            {
                supported && !isAndroidPWA ?
                    <div className={styles['nav-menu-section']}>
                        <Button className={styles['nav-menu-option-container']} title={fullscreen ? t('EXIT_FULLSCREEN') : t('ENTER_FULLSCREEN')} onClick={fullscreen ? exitFullscreen : requestFullscreen}>
                            <Icon className={styles['icon']} name={fullscreen ? 'minimize' : 'maximize'} />
                            <div className={styles['nav-menu-option-label']}>{fullscreen ? t('EXIT_FULLSCREEN') : t('ENTER_FULLSCREEN')}</div>
                        </Button>
                    </div>
                    :
                    null
            }
            <div className={styles['nav-menu-section']}>
                <Button className={styles['nav-menu-option-container']} title={ t('SETTINGS') } href={'#/settings'}>
                    <Icon className={styles['icon']} name={'settings'} />
                    <div className={styles['nav-menu-option-label']}>{ t('SETTINGS') }</div>
                </Button>
                <Button className={styles['nav-menu-option-container']} title={ t('ADDONS') } href={'#/addons'}>
                    <Icon className={styles['icon']} name={'addons-outline'} />
                    <div className={styles['nav-menu-option-label']}>{ t('ADDONS') }</div>
                </Button>
                <Button className={styles['nav-menu-option-container']} title={ t('PLAY_STREAM_URL') } onClick={onPlayMagnetLinkClick}>
                    <Icon className={styles['icon']} name={'link'} />
                    <div className={styles['nav-menu-option-label']}>{ t('PLAY_STREAM_URL') }</div>
                </Button>
            </div>
        </div>
    );
};

NavMenuContent.propTypes = {
    onClick: PropTypes.func
};

const NavMenuContentFallback = () => (
    <div className={styles['nav-menu-container']} />
);

module.exports = withCoreSuspender(NavMenuContent, NavMenuContentFallback);
