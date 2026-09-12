// Data tools the AI Assistant chatbot can call (Gemini function-calling).
// Every tool runs a real query against the user's budget data — the model
// never invents numbers, it only narrates what these functions return.
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { integerToAmount } from '@actual-app/core/shared/util';

import { aqlQuery } from '#queries/aqlQuery';

type SpendingByCategoryArgs = { start: string; end: string };
type TransactionsArgs = {
  start: string;
  end: string;
  category?: string;
  payee?: string;
  limit?: number;
};
type BudgetStatusArgs = { month: string };
type UpcomingBillsArgs = { days?: number };
type CashFlowForecastArgs = { months?: number };

async function getSpendingByCategory({ start, end }: SpendingByCategoryArgs) {
  const { data } = await aqlQuery(
    q('transactions')
      .filter({
        $and: [{ date: { $gte: start } }, { date: { $lte: end } }],
        'account.offbudget': false,
        'payee.transfer_acct': null,
      })
      .groupBy([{ $id: '$category' }])
      .select([
        { category: { $id: '$category.name' } },
        { amount: { $sum: '$amount' } },
      ]),
  );

  return (data as Array<{ category: string | null; amount: number }>)
    .filter(row => row.amount < 0)
    .map(row => ({
      category: row.category || 'Uncategorized',
      spent: Math.abs(integerToAmount(row.amount)),
    }))
    .sort((a, b) => b.spent - a.spent);
}

async function getTransactions({
  start,
  end,
  category,
  payee,
  limit = 25,
}: TransactionsArgs) {
  let query = q('transactions')
    .filter({
      $and: [{ date: { $gte: start } }, { date: { $lte: end } }],
    })
    .orderBy({ date: 'desc' })
    .limit(limit);

  if (category) {
    query = query.filter({ 'category.name': { $like: `%${category}%` } });
  }
  if (payee) {
    query = query.filter({ 'payee.name': { $like: `%${payee}%` } });
  }

  const { data } = await aqlQuery(
    query.select([
      'date',
      { payee: { $id: '$payee.name' } },
      { category: { $id: '$category.name' } },
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

async function getAccountBalances() {
  const accounts = await send('accounts-get');
  const openAccounts = accounts.filter(a => !a.closed);

  const balances = await Promise.all(
    openAccounts.map(async account => {
      const { data } = await aqlQuery(
        q('transactions')
          .filter({ account: account.id })
          .calculate({ $sum: '$amount' }),
      );
      return {
        account: account.name,
        balance: integerToAmount((data as number) || 0),
      };
    }),
  );

  const netWorth = balances.reduce((sum, b) => sum + b.balance, 0);
  return { accounts: balances, netWorth };
}

async function getBudgetStatus({ month }: BudgetStatusArgs) {
  const monthNum = parseInt(month.replace('-', ''), 10);
  // Only one of these tables has rows depending on whether the budget uses
  // the envelope (zero_budgets) or tracking (reflect_budgets) method.
  const [{ data: budgeted }, { data: spent }, { list: categories }] =
    await Promise.all([
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
      ]).then(([zero, reflect]) => ({
        data: [...zero.data, ...reflect.data],
      })),
      aqlQuery(
        q('transactions')
          .filter({
            $and: [
              { date: { $gte: monthUtils.firstDayOfMonth(month) } },
              { date: { $lte: monthUtils.lastDayOfMonth(month) } },
            ],
            'account.offbudget': false,
          })
          .groupBy([{ $id: '$category' }])
          .select([
            { category: { $id: '$category' } },
            { amount: { $sum: '$amount' } },
          ]),
      ),
      send('get-categories'),
    ]);

  const nameById = new Map(
    (categories as Array<{ id: string; name: string }>).map(c => [
      c.id,
      c.name,
    ]),
  );
  const spentById = new Map(
    (spent as Array<{ category: string; amount: number }>).map(row => [
      row.category,
      row.amount,
    ]),
  );

  return (budgeted as Array<{ category: string; amount: number }>).map(row => {
    const spentAmount = spentById.get(row.category) || 0;
    return {
      category: nameById.get(row.category) || 'Unknown',
      budgeted: integerToAmount(row.amount),
      spent: Math.abs(integerToAmount(spentAmount)),
      remaining: integerToAmount(row.amount + spentAmount),
    };
  });
}

async function getUpcomingBills({ days = 14 }: UpcomingBillsArgs) {
  const cutoff = monthUtils.addDays(monthUtils.currentDay(), days);
  const { data } = await aqlQuery(
    q('schedules')
      .filter({
        completed: false,
        next_date: { $lte: cutoff },
      })
      .select([
        'name',
        'next_date',
        { payee: { $id: '$_payee.name' } },
        '_amount',
      ]),
  );

  return (data as Array<Record<string, unknown>>).map(row => ({
    name: row.name,
    dueDate: row.next_date,
    payee: row.payee,
    amount:
      typeof row._amount === 'number' ? integerToAmount(row._amount) : null,
  }));
}

async function getCashFlowForecast({ months = 3 }: CashFlowForecastArgs) {
  const startDate = monthUtils.currentDay();
  const endDate = monthUtils.addMonths(startDate, months);
  return send('forecast/generate', {
    startDate,
    endDate,
  });
}

export const budgetTools = {
  getSpendingByCategory,
  getTransactions,
  getAccountBalances,
  getBudgetStatus,
  getUpcomingBills,
  getCashFlowForecast,
} as const;

export type BudgetToolName = keyof typeof budgetTools;

// Gemini function-calling declarations for the tools above.
export const budgetToolDeclarations = [
  {
    name: 'getSpendingByCategory',
    description:
      'Get total spending grouped by category for a date range. Use this to answer "where did my money go" or "how much did I spend on X" questions.',
    parameters: {
      type: 'object',
      properties: {
        start: { type: 'string', description: 'Start date, YYYY-MM-DD' },
        end: { type: 'string', description: 'End date, YYYY-MM-DD' },
      },
      required: ['start', 'end'],
    },
  },
  {
    name: 'getTransactions',
    description:
      'List individual transactions in a date range, optionally filtered by category or payee name (partial match).',
    parameters: {
      type: 'object',
      properties: {
        start: { type: 'string', description: 'Start date, YYYY-MM-DD' },
        end: { type: 'string', description: 'End date, YYYY-MM-DD' },
        category: { type: 'string' },
        payee: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['start', 'end'],
    },
  },
  {
    name: 'getAccountBalances',
    description:
      'Get the current balance of every open account and the total net worth.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'getBudgetStatus',
    description:
      'Get budgeted vs. spent vs. remaining amounts per category for a given month. Use to answer "am I on track with my budget" questions.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'Month, YYYY-MM' },
      },
      required: ['month'],
    },
  },
  {
    name: 'getUpcomingBills',
    description:
      'List upcoming scheduled transactions (bills) due within a number of days.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Look-ahead window in days' },
      },
    },
  },
  {
    name: 'getCashFlowForecast',
    description:
      'Project future cash flow forward from today based on scheduled transactions and history.',
    parameters: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'Months to project forward' },
      },
    },
  },
] as const;
