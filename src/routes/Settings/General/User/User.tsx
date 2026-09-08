import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './User.less';

type Props = {
    profile: Profile,
};

const User = ({ profile }: Props) => {
    const { t } = useTranslation();

    const avatar = useMemo(() => (
        !profile.auth ?
            `url('${require('/assets/images/anonymous.png')}')`
            :
            profile.auth.user.avatar ?
                `url('${profile.auth.user.avatar}')`
                :
                `url('${require('/assets/images/default_avatar.png')}')`
    ), [profile.auth]);

    return (
        <div className={styles['user']}>
            <div className={styles['user-info-content']}>
                <div
                    className={styles['avatar-container']}
                    style={{ backgroundImage: avatar }}
                />
                <div className={styles['email-logout-container']}>
                    <div className={styles['email-label-container']} title={t('ANONYMOUS_USER')}>
                        <div className={styles['email-label']}>
                            {t('ANONYMOUS_USER')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default User;
