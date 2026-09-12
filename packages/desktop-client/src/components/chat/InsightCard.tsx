import type { ReactNode } from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

export function InsightCard({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: theme.pillBackground,
        border: '1px solid ' + theme.pillBorderDark,
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 8,
      }}
    >
      <Text>{children}</Text>
    </View>
  );
}
