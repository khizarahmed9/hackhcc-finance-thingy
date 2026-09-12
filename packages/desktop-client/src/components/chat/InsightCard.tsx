import type { ReactNode } from 'react';

import { SvgLightBulb } from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

/**
 * A proactive observation shown before the user asks anything. Deliberately
 * quiet — these appear unprompted, so they inform rather than alarm.
 */
export function InsightCard({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
        padding: '10px 12px',
        borderRadius: 6,
        backgroundColor: theme.tableBackground,
        border: `1px solid ${theme.tableBorder}`,
      }}
    >
      <SvgLightBulb
        aria-hidden="true"
        style={{
          width: 14,
          height: 14,
          flexShrink: 0,
          marginTop: 3,
          color: theme.pageTextSubdued,
        }}
      />
      <Text style={{ lineHeight: 1.5 }}>{children}</Text>
    </View>
  );
}
