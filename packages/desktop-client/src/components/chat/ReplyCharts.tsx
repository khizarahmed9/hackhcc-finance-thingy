import { styles } from '@actual-app/components/styles';
import { View } from '@actual-app/components/view';

import type { ReplyChart as ReplyChartData } from './gemini';
import { ReplyChart } from './ReplyChart';

/** Every chart produced for one reply. */
export function ReplyCharts({ charts }: { charts: ReplyChartData[] }) {
  if (!charts.length) {
    return null;
  }

  return (
    <View style={{ gap: 10, flexShrink: 0, ...styles.tnum }}>
      {charts.map((chart, i) => (
        <ReplyChart key={i} chart={chart} />
      ))}
    </View>
  );
}
