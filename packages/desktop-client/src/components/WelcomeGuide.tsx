import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import {
  SvgChatBubbleDots,
  SvgPiggyBank,
  SvgReports,
  SvgWallet,
} from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { BRAND } from '#brand';

const SEEN_KEY = 'wayne.guide.seen';

/** Opens itself once per device; Settings can reopen it afterwards. */
export function hasSeenGuide() {
  try {
    return window.localStorage.getItem(SEEN_KEY) === 'true';
  } catch {
    // Blocked storage: better to show it again than never.
    return false;
  }
}

function markGuideSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, 'true');
  } catch {
    // Not fatal — it just opens again next time.
  }
}

type Section = {
  icon: typeof SvgWallet;
  label: string;
  body: string;
};

type WelcomeGuideProps = {
  onClose: () => void;
};

/**
 * A plain-language explanation of what the app's four places are for.
 *
 * Written for someone who has never used a budgeting app: people testing this
 * could not tell what "accounts", "budget" and "reports" meant, or how they
 * relate. Each section is named after the thing in the sidebar so the words
 * map onto what they can see.
 */
export function WelcomeGuide({ onClose }: WelcomeGuideProps) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    markGuideSeen();
    onClose();
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const sections: Section[] = [
    {
      icon: SvgPiggyBank,
      label: t('Accounts'),
      body: t(
        'Down the left: where your money actually is. Each one shows its real balance, and they add up to what you are worth.',
      ),
    },
    {
      icon: SvgWallet,
      label: t('Budget'),
      body: t(
        'The plan for this month. You give every dollar a job — say $400 to Food — and the page shows what you planned, what you have spent, and what is left. Red means you went over.',
      ),
    },
    {
      icon: SvgChatBubbleDots,
      label: t('Assistant'),
      body: t(
        'Ask it anything about your money, or tell it what to change. It can move money between categories, sort out transactions, and read a receipt you drop in. Anything it changes can be undone.',
      ),
    },
    {
      icon: SvgReports,
      label: t('Reports'),
      body: t(
        'The longer view: what you earn and spend over months rather than days.',
      ),
    },
  ];

  return (
    <View
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
        backgroundColor: 'rgba(4, 4, 10, 0.72)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={close}
    >
      <View
        innerRef={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('How {{brand}} works', { brand: BRAND.name })}
        tabIndex={-1}
        onClick={(e: MouseEvent) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '86vh',
          overflowY: 'auto',
          gap: 20,
          padding: isNarrowWidth ? '24px 20px' : '30px 32px',
          borderRadius: 14,
          backgroundColor: theme.tableBackground,
          border: `1px solid ${theme.tableBorder}`,
          ...styles.shadowLarge,
          outline: 'none',
        }}
      >
        <View style={{ gap: 7 }}>
          <Text
            style={{
              fontSize: 21,
              fontWeight: 600,
              letterSpacing: '-0.015em',
              color: theme.pageText,
            }}
          >
            <Trans>New to budgeting apps?</Trans>
          </Text>
          <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.55 }}>
            <Trans>
              Here is what the four places on the left are for. It takes about
              thirty seconds.
            </Trans>
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          {sections.map(({ icon: Icon, label, body }) => (
            <View
              key={label}
              style={{
                flexDirection: 'row',
                gap: 14,
                alignItems: 'flex-start',
              }}
            >
              <Icon
                aria-hidden="true"
                style={{
                  width: 15,
                  height: 15,
                  flexShrink: 0,
                  marginTop: 4,
                  color: theme.pageTextPositive,
                }}
              />
              <View style={{ gap: 2, flex: 1 }}>
                <Text style={{ fontWeight: 600, color: theme.pageText }}>
                  {label}
                </Text>
                <Text
                  style={{
                    color: theme.pageTextSubdued,
                    lineHeight: 1.5,
                    fontSize: 14.5,
                  }}
                >
                  {body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View
          style={{
            gap: 10,
            paddingTop: 4,
            borderTop: `1px solid ${theme.tableBorder}`,
          }}
        >
          <Text
            style={{
              color: theme.pageTextSubdued,
              fontSize: 14,
              lineHeight: 1.5,
              paddingTop: 14,
            }}
          >
            <Trans>
              The numbers here are made-up sample data, so nothing you do can
              break anything. A good first thing to try: ask the assistant where
              your money went last month.
            </Trans>
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <Button variant="primary" onPress={close}>
              <Trans>Got it</Trans>
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}
