# Wayne Finance

A local-first personal budgeting app with an AI assistant that acts on your
real budget instead of describing it.

**Live: <https://knightfall.wiki>** — it also installs as an app from Chrome's
menu on Android.

Built for HackRice 16 (Finance track).

---

## What it does

Most budgeting apps show you what happened and wait. This one does the work.

**Answers from your actual data.** "How much did I spend on groceries last
month?" runs a query against your transactions. Every figure in a reply came
from a lookup; the model is never asked to recall a number.

**Changes the budget.** "Budget $300 for groceries", "move $50 from Dining to
Gas", "cover my overspending", "categorise my Kroger transactions". Each change
goes through the app's normal handlers, so it lands in the undo stack and the
reply carries an Undo button.

**Reads documents.** Drop in a receipt photo or a bank statement PDF and it
extracts the transactions — date, merchant, amount — files them under
categories that exist in your budget, and tags them `#receipt` or `#statement`
plus something descriptive so they are findable later.

**Listens and talks.** Press the mic to ask out loud; the reply is spoken back.
Starting a recording cuts off playback, so you can interrupt it.

**Remembers you.** Durable facts you share — a savings goal, your payday —
survive across sessions and inform later answers.

**Notices things first.** Before you ask anything it surfaces what changed:
categories over budget, spending running above your own recent average, bills
due that your accounts cannot cover.

---

## How it works

```
browser
├── Actual Budget core ── SQLite budget file (stays on device)
│
└── assistant
    ├── Gemini 3.6 Flash ──── reasoning, function calling, reading documents
    ├── ElevenLabs ────────── Scribe (speech → text), Turbo v2.5 (text → speech)
    └── Backboard ─────────── memory that outlives the tab
```

There is no backend of ours. The app calls each API directly from the browser
with keys supplied at build time, so nothing is proxied through a server we
run.

### The agent loop

`src/components/chat/gemini.ts` holds the loop:

1. The user's message is sent with the full tool list, the date, anything the
   user wrote in **About you**, and any relevant memories.
2. If the model asks for tools, each one runs against the local database and
   the results go back as function responses.
3. Repeat, up to ten rounds.
4. If the rounds run out, the model is asked once more **with tools withheld**
   — "answer from what you already gathered and say what you assumed" — so a
   complex question degrades into an answer rather than an error.

Two details that turned out to matter:

- **Today's date is stated explicitly.** Without it, the model burned rounds
  calling date-revealing tools to work out what "last month" meant.
- **Attachments are only re-sent while recent.** Otherwise every later message
  re-uploads and re-bills the same receipt.

### Tools

Fifteen tools, in `budgetTools.ts` (read) and `budgetActions.ts` (write).

| Read                           | What it returns                                          |
| ------------------------------ | -------------------------------------------------------- |
| `getCategories`                | Every category, grouped — called before filing anything  |
| `getSpendingByCategory`        | Spending per category over a date range                  |
| `getTransactions`              | Individual transactions, filterable by payee or category |
| `getAccountBalances`           | Balance per open account, plus net worth                 |
| `getBudgetStatus`              | Budgeted vs spent vs remaining for a month               |
| `getMonthlySummary`            | Income, spending and net per month, plus average net     |
| `getUpcomingBills`             | Scheduled transactions due within N days                 |
| `getCashFlowForecast`          | Projection forward from today                            |
| `getUncategorizedTransactions` | Transactions with no category yet                        |

| Write                    | What it does                               |
| ------------------------ | ------------------------------------------ |
| `setBudgetAmount`        | Sets a category's budget for a month       |
| `moveBudgetMoney`        | Moves budgeted money between categories    |
| `categorizeTransactions` | Categorises uncategorised transactions     |
| `coverOverspending`      | Covers overspent categories from To Budget |
| `addTransactions`        | Writes transactions read off a document    |
| `rememberAboutMe`        | Stores a durable fact about the user       |

Write tools are listed in `MUTATING_TOOLS`, which is what tells the UI to show
an Undo button.

### Documents

Gemini is multimodal, so a receipt or statement is sent as inline image or PDF
data straight from the browser — no OCR service in between. The model is
instructed to use the document's own total rather than re-adding line items,
to ask which account if the user did not name one, and to check
`getCategories` before filing so it cannot invent a category that does not
exist. A category it cannot match is reported back rather than silently
dropped, and the transaction lands uncategorised with the assistant saying so.

### Voice

`elevenlabs.ts` wraps both directions. Replies are stripped of markdown before
synthesis so the voice does not read punctuation aloud. `useVoice.ts` keeps
recording and playback mutually exclusive.

Microphone capture needs a secure context, so voice only works over HTTPS or
on localhost.

### Memory

`backboard.ts` uses Backboard purely as a memory store — Gemini remains the
brain. Before answering, memories relevant to the question are searched and
handed over as context; when the user states something lasting, the model
writes it back through `rememberAboutMe`.

Only what the user says about themselves is stored. Transactions, balances and
budgets are never sent to Backboard. Settings lists everything remembered and
each fact can be deleted.

Without a Backboard key the assistant simply has no memory; nothing else
changes.

### Insights

`insights.ts` runs five independent checks — overspending, bills measured
against available cash, categories running above their own three-month norm,
recurring charges, and an uncategorised backlog — and shows the three that
matter most. Each is settled separately, so one failing query costs that
insight rather than the panel.

---

## Where your data goes

The budget file is a local SQLite database and never leaves your device. There
is no server of ours in between.

To be precise about the part that does leave: answering a question sends the
relevant figures — the results of the tool calls, not the database — to
Google's API from your browser, using your own key. Voice audio goes to
ElevenLabs the same way. Backboard only ever receives facts you stated about
yourself.

---

## Running it

Requires Node >= 22 and Yarn 4.

```bash
yarn install
cp .env.local.example .env.local   # then fill in your keys
yarn start                         # http://localhost:3001
```

The app opens straight into a demo budget with realistic data — there is no
file picker or welcome screen in this build.

### Keys

`.env.local` at the repo root, gitignored:

```
GEMINI_API_KEY=          # https://aistudio.google.com/apikey
ELEVENLABS_API_KEY=      # optional, for voice
ELEVENLABS_VOICE_ID=     # optional
BACKBOARD_API_KEY=       # optional, for memory
```

Vite inlines these at build time, so **changing a key requires a restart or
rebuild** — editing the file alone does nothing. Anything in Settings is used
as a fallback when the build carries no key.

Because they are inlined, a deployed bundle contains them in plain text. Use a
domain-restricted Gemini key for anything public.

### Checking the APIs without the app

`scripts/ai-debug/` exercises each API from the command line:

```bash
node scripts/ai-debug/gemini-probe.mjs --list-models
node scripts/ai-debug/gemini-probe.mjs --file receipt.png "add this receipt"
node scripts/ai-debug/elevenlabs-probe.mjs --round-trip "test sentence"
node scripts/ai-debug/backboard-probe.mjs
node scripts/ai-debug/serve-build.mjs     # serve a production build locally
```

The Gemini probe replays the real tool-call loop with stubbed budget data and
prints every raw response, which is how most of the agent bugs were found.

---

## Deployment

See [DEPLOY.md](DEPLOY.md). Short version: push to the `ai-finance-chatbot`
branch and a systemd timer on the server pulls, builds and swaps the result in.
Building on the server keeps the API keys off GitHub.

nginx must send `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` — the budget engine runs in a
worker that needs `SharedArrayBuffer`, which browsers only expose to
cross-origin-isolated pages.

---

## Where our code lives

Everything for the assistant is under
`packages/desktop-client/src/components/chat/`:

| File                            | Role                                                 |
| ------------------------------- | ---------------------------------------------------- |
| `Chat.tsx`                      | The page: conversation, composer, attachments, retry |
| `gemini.ts`                     | Agent loop, system prompt, tool dispatch             |
| `budgetTools.ts`                | Read tools                                           |
| `budgetActions.ts`              | Write tools                                          |
| `attachments.ts`                | File intake and base64 encoding                      |
| `elevenlabs.ts` / `useVoice.ts` | Speech in and out                                    |
| `backboard.ts`                  | Memory                                               |
| `insights.ts`                   | Proactive checks                                     |
| `MessageText.tsx`               | Markdown and tabular money rendering                 |

Outside that folder we changed the shell: navigation, the branded startup
screen, `src/brand.ts`, the dark theme's gold accent, the PWA manifest, and the
settings panels for keys, memory and **About you**.

---

## Credits

**This project is a fork of [Actual Budget](https://github.com/actualbudget/actual)**, an
excellent open-source, local-first personal finance app released under the MIT
licence.

Everything that makes budgeting work here — the envelope budgeting engine, the
SQLite storage layer, the transaction register, the reports, the sync
architecture, the component library — is Actual's work, built by its
maintainers and contributors over years. We did not build a budgeting app this
weekend; we built an AI assistant on top of a very good one, and adapted the
surrounding shell to fit.

Our contribution is the assistant layer described above and the changes needed
to present it. Full credit and thanks to the Actual Budget team.

Actual Budget is MIT licensed; this fork remains so. See
[LICENSE.txt](LICENSE.txt).
