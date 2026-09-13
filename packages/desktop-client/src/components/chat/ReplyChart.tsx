import React from 'react';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { theme } from '@actual-app/components/theme';
import { Bar, BarChart, Cell, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartFrame } from './ChartFrame';
import type { ReplyChart as ReplyChartData } from './gemini';

/**
 * Draws the series behind an answer.
 *
 * Some questions are far easier to read as a shape than as a paragraph of
 * figures — where the money went, whether a month was better than the last.
 * The chart never replaces the assistant's text; it sits under it, so the
 * numbers and the picture agree.
 */

// The accent already means "this is the thing" everywhere else in the app.
const CATEGORY_BAR = theme.reportsBlue;

function money(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

const tooltipStyle = {
  backgroundColor: theme.menuBackground,
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 6,
  fontSize: 12,
};

export function ReplyChart({ chart }: { chart: ReplyChartData }) {
  const { isNarrowWidth } = useResponsive();
  const tick = { fill: theme.pageTextSubdued, fontSize: 11 };

  if (chart.kind === 'category') {
    // Horizontal bars: category names are words, and words read better
    // along the axis than rotated under one.
    const height = Math.max(120, chart.points.length * 30 + 20);
    return (
      <ChartFrame title={chart.title} height={height}>
        <BarChart
          data={chart.points}
          layout="vertical"
          margin={{ top: 0, right: 52, bottom: 0, left: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={isNarrowWidth ? 84 : 116}
            tick={tick}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: theme.tableRowBackgroundHover }}
            contentStyle={tooltipStyle}
            labelStyle={{ color: theme.pageText }}
            formatter={(value: unknown) => [money(Number(value)), 'Spent']}
          />
          <Bar
            dataKey="value"
            fill={CATEGORY_BAR}
            radius={[0, 4, 4, 0]}
            label={{
              position: 'right',
              fill: theme.pageTextSubdued,
              fontSize: 11,
              formatter: (value: unknown) => money(Number(value)),
            }}
          />
        </BarChart>
      </ChartFrame>
    );
  }

  // Monthly: net is the number people actually care about, so colour it by
  // sign rather than drawing income and spending as competing bars.
  return (
    <ChartFrame title={chart.title} height={170}>
      <BarChart
        data={chart.points}
        margin={{ top: 16, right: 8, bottom: 0, left: 0 }}
      >
        <XAxis
          dataKey="label"
          tick={tick}
          axisLine={false}
          tickLine={false}
          tickFormatter={(label: string) => label.slice(5)}
        />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: theme.tableRowBackgroundHover }}
          contentStyle={tooltipStyle}
          labelStyle={{ color: theme.pageText }}
          formatter={(value: unknown, name: unknown) => [
            money(Number(value)),
            String(name),
          ]}
        />
        <Bar dataKey="net" radius={[4, 4, 0, 0]} name="Net">
          {chart.points.map((point, i) => (
            <Cell
              key={i}
              fill={point.net >= 0 ? theme.noticeTextLight : theme.errorText}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
