import React from 'react';
import type { ReactNode } from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as Platform from '@actual-app/core/shared/platform';

import { BRAND } from '#brand';

type BudgetNameProps = {
  children?: ReactNode;
};

export function BudgetName({ children }: BudgetNameProps) {
  const hasWindowButtons = !Platform.isBrowser && Platform.OS === 'mac';

  return (
    <View
      style={{
        paddingTop: 35,
        height: 30,
        flexDirection: 'row',
        alignItems: 'center',
        margin: '0 8px 23px 20px',
        userSelect: 'none',
        transition: 'padding .4s',
        ...(hasWindowButtons
          ? {
              paddingTop: 20,
              justifyContent: 'flex-start',
            }
          : {}),
      }}
    >
      <Wordmark />

      <View style={{ flex: 1, flexDirection: 'row' }} />

      {children}
    </View>
  );
}

/**
 * This build opens a single local budget, so the sidebar header carries the
 * product name rather than a file switcher.
 */
function Wordmark() {
  return (
    <Text
      data-testid="budget-name"
      style={{
        color: theme.sidebarItemTextSelected,
        fontSize: 17,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {BRAND.name}
    </Text>
  );
}
