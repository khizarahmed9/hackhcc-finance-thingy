import * as monthUtils from '@actual-app/core/shared/months';

import { budgetTools } from './budgetTools';

/** Proactive "here's what's going on" summaries shown before the user asks anything. */
export async function loadInsights(): Promise<string[]> {
  const insights: string[] = [];
  const month = monthUtils.currentMonth();

  try {
    const spending = await budgetTools.getSpendingByCategory({
      start: monthUtils.firstDayOfMonth(month),
      end: monthUtils.currentDay(),
    });
    if (spending.length > 0) {
      const top = spending[0];
      insights.push(
        `Your biggest spending category this month so far is ${top.category} at $${top.spent.toFixed(2)}.`,
      );
    }
  } catch {
    // Non-fatal — skip this insight if the query fails.
  }

  try {
    const bills = await budgetTools.getUpcomingBills({ days: 7 });
    if (bills.length > 0) {
      insights.push(
        `You have ${bills.length} bill${bills.length === 1 ? '' : 's'} due in the next 7 days.`,
      );
    }
  } catch {
    // Non-fatal.
  }

  return insights;
}
