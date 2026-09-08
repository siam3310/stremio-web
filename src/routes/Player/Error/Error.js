// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useTranslation } = require('react-i18next');
const PropTypes = require('prop-types');
const classNames = require('classnames');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { Button } = require('stremio/components');
const styles = require('./styles');

const Error = React.forwardRef(({ className, code, message, stream }, ref) => {
    const { t } = useTranslation();

    const [playlist, fileName] = React.useMemo(() => {
        return [
            stream?.deepLinks?.externalPlayer?.playlist,
            stream?.deepLinks?.externalPlayer?.fileName,
        ];
    }, [stream]);

    const directStreamUrl = React.useMemo(() => {
        return stream?.url || stream?.externalUrl || null;
    }, [stream]);

    const onRetry = React.useCallback(() => {
        window.location.reload();
    }, []);

    const isPlaybackFormatError = code === 83 || code === 2 || code === 82 || code === 4;

    return (
        <div ref={ref} className={classNames(className, styles['error'])}>
            <div className={styles['error-label']} title={message}>{message}</div>
            {
                isPlaybackFormatError ?
                    <div className={styles['error-sub']} title={t('EXTERNAL_PLAYER_HINT')}>
                        {t('EXTERNAL_PLAYER_HINT') || 'This video format or codec is not natively supported by your browser. You can open it in an external player (e.g. VLC or MPV) or try another stream.'}
                    </div>
                    :
                    null
            }
            <div className={styles['actions-group']}>
                {
                    playlist && fileName ?
                        <Button
                            className={styles['playlist-button']}
                            title={t('PLAYER_OPEN_IN_EXTERNAL')}
                            href={playlist}
                            download={fileName}
                            target={'_blank'}
                        >
                            <Icon className={styles['icon']} name={'ic_downloads'} />
                            <div className={styles['label']}>{t('PLAYER_OPEN_IN_EXTERNAL')}</div>
                        </Button>
                        :
                        directStreamUrl ?
                            <Button
                                className={styles['playlist-button']}
                                title={t('PLAYER_OPEN_IN_EXTERNAL')}
                                href={directStreamUrl}
                                target={'_blank'}
                                rel={'noreferrer'}
                            >
                                <Icon className={styles['icon']} name={'ic_downloads'} />
                                <div className={styles['label']}>{t('PLAYER_OPEN_IN_EXTERNAL')}</div>
                            </Button>
                            :
                            null
                }
                <Button
                    className={styles['playlist-button']}
                    title={'Retry'}
                    onClick={onRetry}
                >
                    <div className={styles['label']}>{'Retry'}</div>
                </Button>
            </div>
        </div>
    );
});

Error.propTypes = {
    className: PropTypes.string,
    code: PropTypes.number,
    message: PropTypes.string,
    stream: PropTypes.object,
};

module.exports = Error;
