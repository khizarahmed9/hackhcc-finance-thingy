import type { ReactElement } from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { ResponsiveContainer } from 'recharts';

type ChartFrameProps = {
  title: string;
  height: number;
  children: ReactElement;
};

/** Shared shell for a chart drawn under an assistant reply. */
export function ChartFrame({ title, height, children }: ChartFrameProps) {
  return (
    <View
      style={{
        flexShrink: 0,
        gap: 10,
        padding: '14px 16px 10px',
        borderRadius: 8,
        backgroundColor: theme.tableBackground,
        border: `1px solid ${theme.tableBorder}`,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: theme.pageTextSubdued,
        }}
      >
        {title}
      </Text>
      <View style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </View>
    </View>
  );
}
