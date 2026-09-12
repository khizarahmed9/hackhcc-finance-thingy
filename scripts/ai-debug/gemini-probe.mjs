// Replays the AI Assistant's Gemini tool-call loop outside the browser, with
// stubbed budget data, dumping the full raw API response for every round.
//
//   node scripts/ai-debug/gemini-probe.mjs "how much did I spend last month?"
//   node scripts/ai-debug/gemini-probe.mjs --list-models
//
// Keep the request shape here in sync with
// packages/desktop-client/src/components/chat/gemini.ts — the point is to
// reproduce what the app sends, byte for byte.
import { loadEnv, requireKey } from './env.mjs';

const env = loadEnv();
const API_KEY = requireKey('GEMINI_API_KEY');
const MODEL =
  process.env.GEMINI_MODEL || env.GEMINI_MODEL || 'gemini-3.6-flash';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

const TODAY = new Date().toISOString().slice(0, 10);

// --no-date reproduces the app's current instruction, which promises a date
// that is never actually supplied.
const SYSTEM_INSTRUCTION = process.argv.includes('--no-date')
  ? `You are a friendly, concise personal finance assistant built into the Actual Budget app.
You have tools to look up the user's real transactions, budgets, account balances, upcoming bills, and cash-flow forecasts — always call a tool instead of guessing when a question needs real numbers.
Today's date will be given to you in the first user turn if relevant. Format money as $X.XX. Keep answers short and actionable, and call out overspending or upcoming bills when relevant.`
  : `You are a friendly, concise personal finance assistant built into the Actual Budget app.
You have tools to look up the user's real transactions, budgets, account balances, upcoming bills, and cash-flow forecasts — always call a tool instead of guessing when a question needs real numbers.
Today's date is ${TODAY}. Resolve relative dates like "last month" against it yourself; never call a tool just to discover the date.
Format money as $X.XX. Keep answers short and actionable, and call out overspending or upcoming bills when relevant.`;

const toolDeclarations = [
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
      properties: { month: { type: 'string', description: 'Month, YYYY-MM' } },
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
  // Write tools — keep in sync with budgetActions.ts.
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
    parameters: { type: 'object', properties: { limit: { type: 'number' } } },
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
      properties: { month: { type: 'string', description: 'Month, YYYY-MM' } },
    },
  },
];

// Stand-ins for the real budget queries, which need a loaded budget file.
// Shapes match what budgetTools.ts returns.
// Vary by date range so repeated probes get distinguishable answers — fixed
// data would make any model re-query, masking the real behaviour.
function seed(str) {
  let h = 0;
  for (const ch of String(str)) {
    h = (h * 31 + ch.charCodeAt(0)) % 997;
  }
  return h;
}

const stubResults = {
  getSpendingByCategory: ({ start = '', end = '' }) => {
    const n = seed(start + end);
    return [
      { category: 'Groceries', spent: 300 + (n % 200) + 0.83 },
      { category: 'Restaurants', spent: 100 + (n % 150) + 0.4 },
      { category: 'Gas', spent: 60 + (n % 80) + 0.12 },
    ];
  },
  getTransactions: () => [
    {
      date: '2026-08-14',
      payee: 'Kroger',
      category: 'Groceries',
      account: 'Checking',
      amount: -82.31,
      notes: null,
    },
    {
      date: '2026-08-11',
      payee: 'Shell',
      category: 'Gas',
      account: 'Checking',
      amount: -41.2,
      notes: null,
    },
  ],
  getAccountBalances: () => ({
    accounts: [
      { account: 'Checking', balance: 2841.19 },
      { account: 'Savings', balance: 9120.0 },
    ],
    netWorth: 11961.19,
  }),
  getBudgetStatus: () => [
    { category: 'Groceries', budgeted: 400, spent: 412.83, remaining: -12.83 },
    { category: 'Gas', budgeted: 120, spent: 96.12, remaining: 23.88 },
  ],
  getUpcomingBills: () => [
    { name: 'Rent', dueDate: '2026-10-01', payee: 'Landlord', amount: -1450 },
  ],
  getCashFlowForecast: () => ({
    startDate: '2026-09-12',
    endDate: '2026-12-12',
    projectedBalance: 8420.55,
  }),
  setBudgetAmount: ({ category, month, amount }) => ({
    changed: `Budgeted $${Number(amount).toFixed(2)} for ${category} in ${month}.`,
  }),
  moveBudgetMoney: ({ from, to, month, amount }) => ({
    changed: `Moved $${Number(amount).toFixed(2)} from ${from} to ${to} in ${month}.`,
  }),
  getUncategorizedTransactions: () => [
    { id: 't1', date: '2026-09-02', payee: 'Kroger', amount: -64.12 },
    { id: 't2', date: '2026-09-04', payee: 'Kroger', amount: -21.88 },
    { id: 't3', date: '2026-09-07', payee: 'Shell', amount: -38.4 },
  ],
  categorizeTransactions: ({ category }) => ({
    changed: `Categorized 2 transactions as ${category}.`,
    count: 2,
  }),
  coverOverspending: () => ({
    changed: 'Covered overspending in 1 category from To Budget.',
    count: 1,
  }),
};

async function listModels() {
  const res = await fetch(`${BASE}/models?key=${encodeURIComponent(API_KEY)}`);
  const body = await res.text();
  if (!res.ok) {
    console.error(`ListModels failed (${res.status}):\n${body}`);
    process.exit(1);
  }
  const { models = [] } = JSON.parse(body);
  const usable = models.filter(m =>
    (m.supportedGenerationMethods || []).includes('generateContent'),
  );
  console.log(`${usable.length} models support generateContent:\n`);
  for (const m of usable) {
    console.log(`  ${m.name.replace('models/', '')}`);
  }
}

async function callGemini(contents) {
  const res = await fetch(
    `${BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents,
        tools: [{ functionDeclarations: toolDeclarations }],
      }),
    },
  );

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini request failed (${res.status}): ${body}`);
  }
  return JSON.parse(body);
}

async function run(prompt) {
  console.log(`model:  ${MODEL}`);
  console.log(`prompt: ${prompt}\n`);

  const contents = [{ role: 'user', parts: [{ text: prompt }] }];

  for (let round = 0; round < 6; round++) {
    console.log(`${'='.repeat(70)}\nROUND ${round + 1}\n${'='.repeat(70)}`);

    const data = await callGemini(contents);
    console.log('--- raw response ---');
    console.log(JSON.stringify(data, null, 2));

    const candidate = data.candidates?.[0];
    console.log(`\nfinishReason: ${candidate?.finishReason}`);
    if (data.usageMetadata) {
      console.log(`usage: ${JSON.stringify(data.usageMetadata)}`);
    }

    const parts = candidate?.content?.parts ?? [];
    const functionCalls = parts.filter(p => 'functionCall' in p);

    if (functionCalls.length === 0) {
      const text = parts
        .map(p => p.text ?? '')
        .join('')
        .trim();
      console.log(
        `\n>>> FINAL TEXT (round ${round + 1}):\n${text || '(empty)'}`,
      );
      return;
    }

    console.log(
      `\ncalls: ${functionCalls
        .map(
          p =>
            `${p.functionCall.name}(${JSON.stringify(p.functionCall.args ?? {})})`,
        )
        .join(', ')}`,
    );

    contents.push({ role: 'model', parts });

    const responseParts = functionCalls.map(({ functionCall }) => {
      const stub = stubResults[functionCall.name];
      const response = stub
        ? { result: stub(functionCall.args ?? {}) }
        : { error: `Unknown tool: ${functionCall.name}` };
      // Gemini 3.x tags each call with an id; the response must echo it or the
      // model can't match results to calls.
      return {
        functionResponse: {
          ...(ECHO_ID && functionCall.id ? { id: functionCall.id } : {}),
          name: functionCall.name,
          response,
        },
      };
    });

    contents.push({ role: 'user', parts: responseParts });
  }

  console.log('\n>>> GAVE UP after 6 rounds. Full conversation:');
  console.log(JSON.stringify(contents, null, 2));
}

const args = process.argv.slice(2);
// --no-echo-id reproduces the original (broken) behaviour for comparison.
const ECHO_ID = !args.includes('--no-echo-id');
if (args.includes('--list-models')) {
  await listModels();
} else {
  const prompt = args.filter(a => !a.startsWith('--')).join(' ');
  await run(prompt || 'How much did I spend on groceries last month?');
}
