import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  SvgChatBubbleDots,
  SvgCog,
  SvgReports,
  SvgWallet,
} from '@actual-app/components/icons/v1';
import { View } from '@actual-app/components/view';

import { Item } from './Item';

/**
 * Four destinations, no submenu. The assistant leads because it is how this
 * build expects people to work: ask, attach, and let it act, rather than
 * navigating to a management screen.
 *
 * Payees, Rules, Tags, Schedules and Bank Sync are power-user surfaces that
 * this build doesn't put in front of people. Their routes still exist, so
 * links from the register (a schedule, a payee) keep working; they just aren't
 * places you navigate to on purpose.
 */
export function PrimaryButtons() {
  const { t } = useTranslation();

  return (
    <View data-testid="sidebar-primary-buttons" style={{ flexShrink: 0 }}>
      <Item title={t('Assistant')} Icon={SvgChatBubbleDots} to="/chat" />
      <Item title={t('Budget')} Icon={SvgWallet} to="/budget" />
      <Item title={t('Reports')} Icon={SvgReports} to="/reports" />
      <Item title={t('Settings')} Icon={SvgCog} to="/settings" />
    </View>
  );
}
