// Write tools the AI Assistant can call — these mutate the user's real budget.
//
// Reads live in budgetTools.ts; anything that changes data lives here so the
// split stays obvious. Every action goes through the normal server handlers,
// which means each one lands in Actual's undo stack and can be reverted with
// `undoLastAction()` — that is what makes it safe to let the model act
// directly instead of forcing a confirmation round-trip for every change.
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { amountToInteger, integerToAmount } from '@actual-app/core/shared/util';

import { aqlQuery } from '#queries/aqlQuery';

type SetBudgetArgs = { category: string; month: string; amount: number };
type MoveMoneyArgs = {
  from: string;
  to: string;
  month: string;
  amount: number;
};
type CategorizeArgs = {
  payee?: string;
  category: string;
  start?: string;
  end?: string;
  limit?: number;
};

type Category = { id: string; name: string; is_income?: boolean };

/**
 * Resolves a user- or model-supplied category name to a real category. Exact
 * match wins, then case-insensitive, then a unique substring match. Ambiguous
 * or missing names throw with the list of options so the model can correct
 * itself on the next turn rather than silently editing the wrong category.
 */
async function resolveCategory(name: string): Promise<Category> {
  const categories = (await send('get-categories')) as {
    list: Category[];
  };
  const list = categories.list ?? [];
  const target = name.trim().toLowerCase();

  const exact = list.find(c => c.name.toLowerCase() === target);
  if (exact) {
    return exact;
  }

  const partial = list.filter(c => c.name.toLowerCase().includes(target));
  if (partial.length === 1) {
    return partial[0];
  }
  if (partial.length > 1) {
    throw new Error(
      `"${name}" matches several categories: ${partial.map(c => c.name).join(', ')}. Ask the user which one they mean.`,
    );
  }
  throw new Error(
    `No category named "${name}". Available categories: ${list.map(c => c.name).join(', ')}.`,
  );
}

function normalizeMonth(month: string) {
  // Accept "2026-09" or a full date and reduce to the month Actual expects.
  return month.length > 7 ? month.slice(0, 7) : month;
}

async function setBudgetAmount({ category, month, amount }: SetBudgetArgs) {
  const resolved = await resolveCategory(category);
  const targetMonth = normalizeMonth(month);

  await send('budget/budget-amount', {
    category: resolved.id,
    month: targetMonth,
    amount: amountToInteger(amount),
  });

  return {
    changed: `Budgeted $${amount.toFixed(2)} for ${resolved.name} in ${targetMonth}.`,
    category: resolved.name,
    month: targetMonth,
    amount,
  };
}

async function moveBudgetMoney({ from, to, month, amount }: MoveMoneyArgs) {
  const targetMonth = normalizeMonth(month);
  // "to budget" / "available" is a real transfer target, not a category.
  const isToBudget = (name: string) =>
    /^(to.?budget|available|unassigned|ready to assign)$/i.test(name.trim());

  const fromCategory = isToBudget(from) ? null : await resolveCategory(from);
  const toCategory = isToBudget(to) ? null : await resolveCategory(to);

  await send('budget/transfer-category', {
    month: targetMonth,
    amount: amountToInteger(amount),
    from: fromCategory ? fromCategory.id : 'to-budget',
    to: toCategory ? toCategory.id : 'to-budget',
    currencyCode: '',
  });

  const fromName = fromCategory ? fromCategory.name : 'To Budget';
  const toName = toCategory ? toCategory.name : 'To Budget';
  return {
    changed: `Moved $${amount.toFixed(2)} from ${fromName} to ${toName} in ${targetMonth}.`,
    from: fromName,
    to: toName,
    month: targetMonth,
    amount,
  };
}

async function getUncategorizedTransactions({ limit = 50 } = {}) {
  const { data } = await aqlQuery(
    q('transactions')
      .filter({ category: null, 'payee.transfer_acct': null })
      .orderBy({ date: 'desc' })
      .limit(limit)
      .select([
        'id',
        'date',
        { payee: { $id: '$payee.name' } },
        { account: { $id: '$account.name' } },
        'amount',
        'notes',
      ]),
  );

  return (data as Array<Record<string, unknown>>).map(row => ({
    ...row,
    amount: integerToAmount(row.amount as number),
  }));
}

/**
 * Assigns a category to uncategorized transactions, optionally narrowed to a
 * payee and/or date range. Only touches transactions that have no category, so
 * the model can't silently reclassify work the user already did by hand.
 */
async function categorizeTransactions({
  payee,
  category,
  start,
  end,
  limit = 100,
}: CategorizeArgs) {
  const resolved = await resolveCategory(category);

  let query = q('transactions')
    .filter({ category: null, 'payee.transfer_acct': null })
    .orderBy({ date: 'desc' })
    .limit(limit);

  if (payee) {
    query = query.filter({ 'payee.name': { $like: `%${payee}%` } });
  }
  if (start) {
    query = query.filter({ date: { $gte: start } });
  }
  if (end) {
    query = query.filter({ date: { $lte: end } });
  }

  const { data } = await aqlQuery(
    query.select(['id', 'date', { payee: { $id: '$payee.name' } }, 'amount']),
  );
  const matches = data as Array<{ id: string; payee: string; amount: number }>;

  if (matches.length === 0) {
    return {
      changed: 'No uncategorized transactions matched — nothing to do.',
      count: 0,
    };
  }

  await send('transactions-batch-update', {
    updated: matches.map(t => ({ id: t.id, category: resolved.id })),
  });

  return {
    changed: `Categorized ${matches.length} transaction${matches.length === 1 ? '' : 's'} as ${resolved.name}.`,
    count: matches.length,
    category: resolved.name,
    examples: matches.slice(0, 5).map(t => ({
      payee: t.payee,
      amount: integerToAmount(t.amount),
    })),
  };
}

async function coverOverspending({ month }: { month?: string } = {}) {
  const targetMonth = normalizeMonth(month || monthUtils.currentMonth());
  const monthNum = parseInt(targetMonth.replace('-', ''), 10);

  const [{ data: budgeted }, { data: spent }] = await Promise.all([
    Promise.all([
      aqlQuery(
        q('zero_budgets')
          .filter({ month: monthNum })
          .select(['category', 'amount']),
      ),
      aqlQuery(
        q('reflect_budgets')
          .filter({ month: monthNum })
          .select(['category', 'amount']),
      ),
    ]).then(([zero, reflect]) => ({ data: [...zero.data, ...reflect.data] })),
    aqlQuery(
      q('transactions')
        .filter({
          $and: [
            { date: { $gte: monthUtils.firstDayOfMonth(targetMonth) } },
            { date: { $lte: monthUtils.lastDayOfMonth(targetMonth) } },
          ],
          'account.offbudget': false,
        })
        .groupBy([{ $id: '$category' }])
        .select([
          { category: { $id: '$category' } },
          { amount: { $sum: '$amount' } },
        ]),
    ),
  ]);

  const spentById = new Map(
    (spent as Array<{ category: string; amount: number }>).map(r => [
      r.category,
      r.amount,
    ]),
  );

  const overspent = (budgeted as Array<{ category: string; amount: number }>)
    .map(row => ({
      category: row.category,
      remaining: row.amount + (spentById.get(row.category) || 0),
    }))
    .filter(row => row.remaining < 0);

  if (overspent.length === 0) {
    return { changed: 'Nothing is overspent this month.', count: 0 };
  }

  for (const row of overspent) {
    await send('budget/cover-overspending', {
      month: targetMonth,
      to: row.category,
      from: 'to-budget',
      currencyCode: '',
    });
  }

  return {
    changed: `Covered overspending in ${overspent.length} categor${overspent.length === 1 ? 'y' : 'ies'} from To Budget.`,
    count: overspent.length,
    total: overspent.reduce(
      (sum, r) => sum + Math.abs(integerToAmount(r.remaining)),
      0,
    ),
  };
}

/** Reverts the most recent change — wired to the Undo button on action cards. */
export async function undoLastAction() {
  await send('undo');
}

export const budgetActionTools = {
  setBudgetAmount,
  moveBudgetMoney,
  getUncategorizedTransactions,
  categorizeTransactions,
  coverOverspending,
} as const;

export type BudgetActionName = keyof typeof budgetActionTools;

/** Tools that change data — used to flag replies as undoable in the UI. */
export const MUTATING_TOOLS = new Set<string>([
  'setBudgetAmount',
  'moveBudgetMoney',
  'categorizeTransactions',
  'coverOverspending',
]);

export const budgetActionDeclarations = [
  {
    name: 'setBudgetAmount',
    description:
      "Set how much is budgeted for a category in a given month. Use when the user asks to budget, allocate, or assign a specific amount. This changes the user's data.",
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category name' },
        month: { type: 'string', description: 'Month, YYYY-MM' },
        amount: {
          type: 'number',
          description: 'Dollar amount, e.g. 250.00 (not cents)',
        },
      },
      required: ['category', 'month', 'amount'],
    },
  },
  {
    name: 'moveBudgetMoney',
    description:
      'Move budgeted money from one category to another in a given month. Use "To Budget" as the from/to name to move money to or from the unassigned pool. This changes the user\'s data.',
    parameters: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Source category, or "To Budget"',
        },
        to: { type: 'string', description: 'Target category, or "To Budget"' },
        month: { type: 'string', description: 'Month, YYYY-MM' },
        amount: { type: 'number', description: 'Dollar amount to move' },
      },
      required: ['from', 'to', 'month', 'amount'],
    },
  },
  {
    name: 'getUncategorizedTransactions',
    description:
      'List transactions that have no category yet. Call this before categorizing so you can suggest sensible categories.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
  },
  {
    name: 'categorizeTransactions',
    description:
      "Assign a category to uncategorized transactions, optionally narrowed by payee and date range. Only affects transactions that currently have no category. This changes the user's data.",
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category name to assign' },
        payee: {
          type: 'string',
          description: 'Only transactions whose payee matches this text',
        },
        start: { type: 'string', description: 'Start date, YYYY-MM-DD' },
        end: { type: 'string', description: 'End date, YYYY-MM-DD' },
        limit: { type: 'number' },
      },
      required: ['category'],
    },
  },
  {
    name: 'coverOverspending',
    description:
      "Cover every overspent category for a month by pulling from the unassigned To Budget pool. This changes the user's data.",
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'Month, YYYY-MM' },
      },
    },
  },
] as const;
