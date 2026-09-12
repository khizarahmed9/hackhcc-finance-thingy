import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { integerToAmount } from '@actual-app/core/shared/util';

import { aqlQuery } from '#queries/aqlQuery';

import { budgetTools } from './budgetTools';
import { formatMoney } from './formatMoney';

/**
 * Proactive observations shown before the user asks anything.
 *
 * Each check is independent and failure-tolerant: a query that throws costs
 * that one insight, never the panel. Results are ranked so the things that
 * cost money (overspending, a bill you can't cover) sort above housekeeping,
 * and only the top few are shown — an unranked wall of notices is noise.
 */

export type Insight = {
  text: string;
  /** Lower sorts first. */
  rank: number;
  /** Category this is about, so two notices don't pile onto the same one. */
  subject?: string;
};

const MAX_INSIGHTS = 3;

const currency = formatMoney;

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

/** Categories already over budget this month. */
async function overspentCategories(month: string): Promise<Insight[]> {
  const status = await budgetTools.getBudgetStatus({ month });
  const over = status
    .filter(row => row.remaining < 0)
    .sort((a, b) => a.remaining - b.remaining);

  if (over.length === 0) {
    return [];
  }

  const total = over.reduce((sum, row) => sum + Math.abs(row.remaining), 0);
  const worst = over[0];
  return [
    {
      rank: 0,
      subject: worst.category,
      text:
        over.length === 1
          ? `${worst.category} is over budget by ${await currency(Math.abs(worst.remaining))}. Ask me to cover it.`
          : `${over.length} categories are over budget by ${await currency(total)} in total — ${worst.category} is the worst at ${await currency(Math.abs(worst.remaining))}.`,
    },
  ];
}

/** Bills due soon measured against what is actually in the on-budget accounts. */
async function billsVersusCash(): Promise<Insight[]> {
  const [bills, balances] = await Promise.all([
    budgetTools.getUpcomingBills({ days: 7 }),
    budgetTools.getAccountBalances(),
  ]);

  if (bills.length === 0) {
    return [];
  }

  const due = bills.reduce(
    (sum, bill) =>
      sum + Math.abs(typeof bill.amount === 'number' ? bill.amount : 0),
    0,
  );
  const onHand = balances.accounts.reduce(
    (sum, account) => sum + Math.max(0, account.balance),
    0,
  );

  const noun = plural(bills.length, 'bill', 'bills');
  if (due > 0 && due > onHand) {
    return [
      {
        rank: 1,
        text: `${bills.length} ${noun} totalling ${await currency(due)} ${plural(bills.length, 'is', 'are')} due within 7 days, but your accounts only hold ${await currency(onHand)}.`,
      },
    ];
  }

  return [
    {
      rank: 4,
      text:
        due > 0
          ? `${bills.length} ${noun} totalling ${await currency(due)} due in the next 7 days.`
          : `${bills.length} ${noun} due in the next 7 days.`,
    },
  ];
}

/**
 * Categories running well above their own recent norm. Compares this month so
 * far against the same number of days averaged over the previous three months,
 * so an early-month check isn't compared against full months.
 */
async function spendingAnomalies(month: string): Promise<Insight[]> {
  const today = monthUtils.currentDay();
  const dayOfMonth = parseInt(today.slice(8, 10), 10);

  const current = await budgetTools.getSpendingByCategory({
    start: monthUtils.firstDayOfMonth(month),
    end: today,
  });
  if (current.length === 0) {
    return [];
  }

  const priorMonths = [1, 2, 3].map(n => monthUtils.subMonths(month, n));
  const priorTotals = new Map<string, number>();

  for (const prior of priorMonths) {
    const start = monthUtils.firstDayOfMonth(prior);
    // Same slice of the month, so the comparison is like for like.
    const end = monthUtils.addDays(start, dayOfMonth - 1);
    const rows = await budgetTools.getSpendingByCategory({ start, end });
    for (const row of rows) {
      priorTotals.set(
        row.category,
        (priorTotals.get(row.category) || 0) + row.spent,
      );
    }
  }

  const anomalies = current
    .map(row => {
      const baseline =
        (priorTotals.get(row.category) || 0) / priorMonths.length;
      return {
        ...row,
        baseline,
        ratio: baseline > 0 ? row.spent / baseline : 0,
      };
    })
    // Needs a real baseline and enough money involved to be worth saying.
    .filter(row => row.baseline >= 20 && row.spent >= 50 && row.ratio >= 1.5)
    .sort((a, b) => b.ratio - a.ratio);

  if (anomalies.length === 0) {
    return [];
  }

  const worst = anomalies[0];
  return [
    {
      rank: 2,
      subject: worst.category,
      text: `${worst.category} is running ${worst.ratio.toFixed(1)}× your usual pace — ${await currency(worst.spent)} so far versus ${await currency(worst.baseline)} by this point in recent months.`,
    },
  ];
}

/** Recurring charges, so subscriptions creeping up are visible. */
async function recurringCharges(): Promise<Insight[]> {
  const start = monthUtils.subMonths(monthUtils.currentMonth(), 3);
  const { data } = await aqlQuery(
    q('transactions')
      .filter({
        $and: [{ date: { $gte: monthUtils.firstDayOfMonth(start) } }],
        'account.offbudget': false,
        'payee.transfer_acct': null,
      })
      .select([{ payee: { $id: '$payee.name' } }, 'amount', 'date'])
      .limit(2000),
  );

  const byPayee = new Map<string, number[]>();
  for (const row of data as Array<{ payee: string | null; amount: number }>) {
    if (!row.payee || row.amount >= 0) {
      continue;
    }
    const amount = Math.abs(integerToAmount(row.amount));
    byPayee.set(row.payee, [...(byPayee.get(row.payee) || []), amount]);
  }

  // A charge appearing monthly at a near-constant amount reads as a subscription.
  const subscriptions = [...byPayee.entries()]
    .map(([payee, amounts]) => {
      const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const steady = amounts.every(
        a => Math.abs(a - avg) <= Math.max(1, avg * 0.1),
      );
      return { payee, count: amounts.length, avg, steady };
    })
    .filter(s => s.count >= 3 && s.steady && s.avg >= 3);

  if (subscriptions.length === 0) {
    return [];
  }

  // Each of these bills at a steady amount roughly monthly, so its average
  // charge is already its monthly cost — summing them gives the monthly total.
  const monthly = subscriptions.reduce((sum, s) => sum + s.avg, 0);
  return [
    {
      rank: 3,
      text:
        subscriptions.length === 1
          ? `A recurring charge of about ${await currency(monthly)} a month is hitting these accounts.`
          : `${subscriptions.length} recurring charges totalling about ${await currency(monthly)} a month.`,
    },
  ];
}

/** Transactions with no category yet — the assistant can fix these in one ask. */
async function uncategorizedBacklog(): Promise<Insight[]> {
  const { data } = await aqlQuery(
    q('transactions')
      .filter({ category: null, 'payee.transfer_acct': null })
      .calculate({ $count: '$id' }),
  );

  const count = (data as number) || 0;
  if (count < 3) {
    return [];
  }

  return [
    {
      rank: 5,
      text: `${count} transactions have no category yet. Ask me to sort them out.`,
    },
  ];
}

export async function loadInsights(): Promise<string[]> {
  const month = monthUtils.currentMonth();

  const checks = [
    overspentCategories(month),
    billsVersusCash(),
    spendingAnomalies(month),
    recurringCharges(),
    uncategorizedBacklog(),
  ];

  // One failing query shouldn't empty the panel.
  const settled = await Promise.allSettled(checks);
  const insights = settled.flatMap(result =>
    result.status === 'fulfilled' ? result.value : [],
  );

  const seenSubjects = new Set<string>();
  return insights
    .sort((a, b) => a.rank - b.rank)
    .filter(insight => {
      // Two notices about the same category is repetition, not coverage.
      if (!insight.subject) {
        return true;
      }
      if (seenSubjects.has(insight.subject)) {
        return false;
      }
      seenSubjects.add(insight.subject);
      return true;
    })
    .slice(0, MAX_INSIGHTS)
    .map(insight => insight.text);
}
