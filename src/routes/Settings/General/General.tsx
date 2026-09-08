import React, { forwardRef, useMemo } from 'react';
import { useCore } from 'stremio/core';
import { Toggle } from 'stremio/components';
import { useDiscord } from 'stremio/common';
import { Section, Option, Link } from '../components';
import User from './User';
import styles from './General.less';

type Props = {
    profile: Profile,
};

const General = forwardRef<HTMLDivElement, Props>(({ profile }: Props, ref) => {
    const core = useCore();
    const discord = useDiscord();

    const discordToggle = useMemo(() => ({
        checked: profile.settings.discordRpcEnabled === true,
        onClick: () => {
            core.transport.dispatch({
                action: 'Ctx',
                args: {
                    action: 'UpdateSettings',
                    args: {
                        ...profile.settings,
                        discordRpcEnabled: !profile.settings.discordRpcEnabled
                    }
                }
            });
        }
    }), [profile.settings]);

    return <>
        <Section ref={ref}>
            <User profile={profile} />
        </Section>

        <Section>
            <Link
                label={'Browse & Manage Connected Add-ons'}
                href={'#/addons'}
            />
            {
                discord.available &&
                    <Option className={styles['discord-container']} icon={'discord'} label={'SETTINGS_DISCORD'}>
                        <Toggle
                            tabIndex={-1}
                            {...discordToggle}
                        />
                    </Option>
            }
        </Section>
    </>;
});

export default General;
