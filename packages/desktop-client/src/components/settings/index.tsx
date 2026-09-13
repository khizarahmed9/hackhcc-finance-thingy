import React, { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { tokens } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';
import { listen } from '@actual-app/core/platform/client/connection';
import { css } from '@emotion/css';

import { getLatestAppVersion } from '#app/appSlice';
import { BRAND } from '#brand';
import { Link } from '#components/common/Link';
import { Checkbox } from '#components/forms';
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { Page } from '#components/Page';
import { useServerVersion } from '#components/ServerContext';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useGlobalPref } from '#hooks/useGlobalPref';
import { useMetadataPref } from '#hooks/useMetadataPref';
import { loadPrefs, saveSyncedPrefs } from '#prefs/prefsSlice';
import { useDispatch, useSelector } from '#redux';

import { AIAssistantSettings } from './AIAssistant';
import { BudgetTypeSettings } from './BudgetTypeSettings';
import { CurrencySettings } from './Currency';
import { ExperimentalFeatures } from './Experimental';
import { ExportBudget } from './Export';
import { FormatSettings } from './Format';
import { GuideSettings } from './Guide';
import { LanguageSettings } from './LanguageSettings';
import { MemorySettings } from './Memory';
import { RepairTransactions } from './RepairTransactions';
import { ResetCache } from './Reset';
import { ResetDemoSettings } from './ResetDemo';
import { ThemeSettings } from './Themes';
import { AdvancedToggle, Setting } from './UI';

function About() {
  const version = useServerVersion();
  const versionInfo = useSelector(state => state.app.versionInfo);
  const [notifyWhenUpdateIsAvailable, setNotifyWhenUpdateIsAvailablePref] =
    useGlobalPref('notifyWhenUpdateIsAvailable', () => {
      void dispatch(getLatestAppVersion());
    });
  const dispatch = useDispatch();
  const [showNewsFeed, setShowNewsFeedPref] = useGlobalPref('showNewsFeed');
  const isNewsFeedEnabled = Boolean(showNewsFeed);

  return (
    <Setting>
      <Text>
        <strong>{BRAND.name}</strong>{' '}
        <Trans>
          is a private, local-first money manager with an AI assistant that
          works on your real budget. Your budget file stays on this device —
          only what is needed to answer a question is sent, straight from your
          browser.
        </Trans>
      </Text>
      <View
        style={{
          flexDirection: 'column',
          gap: 10,
        }}
        className={css({
          [`@media (min-width: ${tokens.breakpoint_small})`]: {
            display: 'grid',
            gridTemplateRows: '1fr 1fr',
            gridTemplateColumns: '50% 50%',
            columnGap: '2em',
            gridAutoFlow: 'column',
          },
        })}
        data-vrt-mask
      >
        <Text>
          <Trans>
            Client version: {{ version: `v${window.Actual?.ACTUAL_VERSION}` }}
          </Trans>
        </Text>
        <Text>
          <Trans>Server version: {{ version }}</Trans>
        </Text>

        {notifyWhenUpdateIsAvailable && versionInfo?.isOutdated ? (
          <Link
            variant="external"
            to="https://actualbudget.org/docs/releases"
            linkColor="purple"
          >
            <Trans>New version available: {versionInfo.latestVersion}</Trans>
          </Link>
        ) : (
          <Text style={{ color: theme.noticeText, fontWeight: 600 }}>
            {notifyWhenUpdateIsAvailable ? (
              <Trans>You're up to date!</Trans>
            ) : null}
          </Text>
        )}
        <Text>
          <Link
            variant="external"
            to="https://actualbudget.org/docs/releases"
            linkColor="purple"
          >
            <Trans>Release Notes</Trans>
          </Link>
          {isNewsFeedEnabled && (
            <>
              {' · '}
              <Link variant="internal" to="/notifications">
                <Trans>Notifications</Trans>
              </Link>
            </>
          )}
        </Text>
      </View>
      <View style={{ gap: 5 }}>
        <Text style={{ display: 'flex' }}>
          <Checkbox
            id="settings-notifyWhenUpdateIsAvailable"
            checked={notifyWhenUpdateIsAvailable}
            onChange={e =>
              setNotifyWhenUpdateIsAvailablePref(e.currentTarget.checked)
            }
          />
          <label htmlFor="settings-notifyWhenUpdateIsAvailable">
            <Trans>Display a notification when updates are available</Trans>
          </label>
        </Text>
        <Text style={{ display: 'flex' }}>
          <Checkbox
            id="settings-showNewsFeed"
            checked={showNewsFeed}
            onChange={e => setShowNewsFeedPref(e.currentTarget.checked)}
          />
          <label htmlFor="settings-showNewsFeed">
            <Trans>
              Show in-app notifications (release notes and announcements)
            </Trans>
          </label>
        </Text>
      </View>
    </Setting>
  );
}

function IDName({ children }: { children: ReactNode }) {
  return <Text style={{ fontWeight: 500 }}>{children}</Text>;
}

function AdvancedAbout() {
  const [budgetId] = useMetadataPref('id');
  const [groupId] = useMetadataPref('groupId');
  const { t } = useTranslation();

  return (
    <Setting>
      <Text>
        <Trans>
          <strong>IDs</strong> are the names this app uses to identify your
          budget internally. There are several different IDs associated with
          your budget. The Budget ID is used to identify your budget file. The
          Sync ID is used to access the budget on the server.
        </Trans>
      </Text>
      <Text>
        <Trans>
          <IDName>Budget ID:</IDName> {{ budgetId }}
        </Trans>
      </Text>
      <Text style={{ color: theme.pageText }}>
        <Trans>
          <IDName>Sync ID:</IDName> {{ syncId: groupId || t('(none)') }}
        </Trans>
      </Text>
      {/* low priority todo: eliminate some or all of these, or decide when/if to show them */}
      {/* <Text>
        <IDName>Cloud File ID:</IDName> {prefs.cloudFileId || t('(none)')}
      </Text>
      <Text>
        <IDName>User ID:</IDName> {prefs.userId || t('(none)')}
      </Text> */}
    </Setting>
  );
}

export function Settings() {
  const { t } = useTranslation();
  const [floatingSidebar] = useGlobalPref('floatingSidebar');
  const dispatch = useDispatch();
  const isCurrencyExperimentalEnabled = useFeatureFlag('currency');

  useEffect(() => {
    const unlisten = listen('prefs-updated', () => {
      void dispatch(loadPrefs());
    });

    void dispatch(loadPrefs());
    return () => unlisten();
  }, [dispatch]);

  useEffect(() => {
    if (!isCurrencyExperimentalEnabled) {
      void dispatch(saveSyncedPrefs({ prefs: { defaultCurrencyCode: '' } }));
    }
  }, [dispatch, isCurrencyExperimentalEnabled]);

  const { isNarrowWidth } = useResponsive();

  return (
    <Page
      header={t('Settings')}
      style={{
        marginInline: floatingSidebar && !isNarrowWidth ? 'auto' : 0,
      }}
    >
      <View
        data-testid="settings"
        style={{
          marginTop: 10,
          flexShrink: 0,
          maxWidth: 530,
          width: '100%',
          gap: 30,
          paddingBottom: MOBILE_NAV_HEIGHT,
        }}
      >
        {/* Sync, encryption and multi-file settings are omitted: this build
            is single-device and has no server to talk to. */}
        <About />
        <GuideSettings />
        <AIAssistantSettings />
        <MemorySettings />
        <ThemeSettings />
        <FormatSettings />
        {isCurrencyExperimentalEnabled && <CurrencySettings />}
        <LanguageSettings />
        <BudgetTypeSettings />
        <ExportBudget />
        <ResetDemoSettings />
        <AdvancedToggle>
          <AdvancedAbout />
          <ResetCache />
          <RepairTransactions />
          <ExperimentalFeatures />
        </AdvancedToggle>
      </View>
    </Page>
  );
}
