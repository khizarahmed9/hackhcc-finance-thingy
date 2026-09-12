// Client-side Gemini function-calling orchestration for the AI Assistant.
// Calls the Gemini REST API directly from the browser using a user-supplied
// API key (stored locally, see GlobalPrefs.geminiApiKey) — no server needed.
import * as monthUtils from '@actual-app/core/shared/months';

import { recallMemories } from './backboard';
import {
  budgetActionDeclarations,
  budgetActionTools,
  MUTATING_TOOLS,
} from './budgetActions';
import { budgetToolDeclarations, budgetTools } from './budgetTools';

// Reads and writes are declared together so the model picks freely between
// answering a question and acting on it.
const allTools: Record<string, (args: never) => Promise<unknown>> = {
  ...budgetTools,
  ...budgetActionTools,
};
const allDeclarations = [
  ...budgetToolDeclarations,
  ...budgetActionDeclarations,
];

const GEMINI_MODEL = 'gemini-3.6-flash';

/**
 * How many trailing messages still carry their documents in full. A turn is a
 * user message plus a reply, so this is roughly the last two exchanges.
 */
const ATTACHMENT_CONTEXT_MESSAGES = 4;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type ChatRole = 'user' | 'model';

/** A receipt, invoice or statement the user attached, already base64-encoded. */
export type Attachment = {
  name: string;
  mimeType: string;
  /** base64, without the data: URL prefix. */
  data: string;
};

export type ChatMessage = {
  role: ChatRole;
  text: string;
  attachments?: Attachment[];
};

// The date has to be stated explicitly: without it the model burns tool-call
// rounds probing date-revealing tools (upcoming bills, forecasts, balances)
// just to work out what "last month" means, and often never converges.
function buildSystemInstruction(memories: string[] = [], background = '') {
  const about = background.trim()
    ? `\n\nWhat this person told you about themselves:\n${background.trim()}\n`
    : '';
  const remembered = memories.length
    ? `\n\nWhat you already know about this person, from earlier conversations:\n${memories.map(m => `- ${m}`).join('\n')}\nUse these naturally where they help. Don't recite them back or announce that you remembered something unless the user asks what you know.\n`
    : '';

  return `You are a friendly, concise personal finance assistant built into the Wayne Finance app.${about}${remembered}
You have tools to look up the user's real transactions, budgets, account balances, upcoming bills, and cash-flow forecasts — always call a tool instead of guessing when a question needs real numbers.
Today's date is ${monthUtils.currentDay()}. Resolve relative dates like "last month" or "this year" against it yourself; never call a tool just to discover the current date.

You can also CHANGE the budget: set budgeted amounts, move money between categories, categorize transactions, and cover overspending. Rules for acting:
- Act when the user clearly asks you to ("budget $300 for groceries", "move $50 from dining to gas", "categorize my Kroger transactions"). Do it, then say plainly what you changed.
- Do not make changes the user did not ask for. If a request is ambiguous about amount, category, or month, ask one short question first.
- Every change can be undone by the user, so don't hedge or ask for confirmation twice.
- After changing something, state the new state in one sentence.

The user can attach receipts, invoices and bank statements as images or PDFs. When they do:

1. Read it. Pull out every transaction: date, merchant, and the amount actually paid. Spending is NEGATIVE, income positive. Use the document's own TOTAL for a receipt — one transaction per receipt, not one per line item. A statement with many rows becomes many transactions. If the year is missing, infer it from today's date. Never invent a transaction or a total you cannot read.

2. Ask which account, unless the user already named one. Do not guess and do not default to the first account. Call getAccountBalances to see what exists, list the account names, and ask. Wait for the answer before calling addTransactions. If the user did name an account, use that name directly and don't look anything up.

3. Categorize it properly. Call getCategories and pick the closest category that ACTUALLY EXISTS in this budget. Never invent one — an unrecognized name means the transaction lands uncategorized. If nothing fits, say so and leave it uncategorized rather than forcing a bad match.

4. Tag it. Put a hashtag in the transaction's notes so these are easy to find later: always #receipt (or #statement for a statement), plus one short tag for the merchant or kind of spend, like "#receipt #groceries". Tags are single words with no spaces — use #eating-out, not #eating out. Keep any other useful detail in the notes too.

5. Report honestly. Say what you added, to which account, and what you tagged it. If the tool tells you something was left uncategorized, say that plainly instead of claiming it was filed.

When the user TELLS you something about themselves rather than asking a question — a savings goal, a payday, a commitment, a preference — that is not a request to analyse anything. Call rememberAboutMe for each durable fact, acknowledge it in one short sentence, and stop. Do not look up transactions, budgets or forecasts unless they actually asked. Never store their transactions or balances, only what they said about themselves.

General rules:
- Never state a number you did not get from a tool or read off a document.
- When a tool returns a warning, pass it on to the user rather than glossing over it.
- Prefer one short question over a wrong assumption, but don't ask twice about the same thing.

Format money as $X.XX. Keep answers short and actionable, and call out overspending or upcoming bills when relevant.`;
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | {
      functionCall: {
        id?: string;
        name: string;
        args: Record<string, unknown>;
      };
    }
  | {
      functionResponse: {
        id?: string;
        name: string;
        response: { result: unknown } | { error: string };
      };
    };

// The API no longer accepts a 'function' role — function responses go back
// as a 'user' turn, same as a plain user message would.
type GeminiContent = {
  role: 'user' | 'model';
  parts: GeminiPart[];
};

/** Turns an HTTP status into something worth showing a person. */
function describeGeminiFailure(status: number) {
  switch (status) {
    case 400:
      return 'Gemini rejected that request. If you attached a file, try a smaller one or a different format.';
    case 401:
    case 403:
      return 'That Gemini API key was rejected. Check the key in Settings.';
    case 429:
      return 'Gemini is rate limiting this key. Wait a few seconds and try again.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Gemini is temporarily unavailable. Try again in a moment.';
    default:
      return `Gemini could not answer right now (error ${status}). Try again.`;
  }
}

async function callGemini(
  apiKey: string,
  contents: GeminiContent[],
  memories: string[],
  background: string,
) {
  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildSystemInstruction(memories, background) }],
      },
      contents,
      tools: [{ functionDeclarations: allDeclarations }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // The raw API body is developer output; say what the user can do instead.
    console.error('[AI Assistant] Gemini request failed', res.status, body);
    throw new Error(describeGeminiFailure(res.status));
  }

  const data = await res.json();
  if (data.promptFeedback?.blockReason) {
    throw new Error(
      `Gemini blocked the request: ${data.promptFeedback.blockReason}`,
    );
  }
  return data;
}

async function runTool(name: string, args: Record<string, unknown>) {
  const tool = allTools[name];
  if (!tool) {
    return { error: `Unknown tool: ${name}` };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tool as (args: any) => Promise<unknown>)(args);
    return { result };
  } catch (err) {
    // Surfaced back to the model, not thrown: a bad category name or date is
    // something it can correct on the next turn.
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** A data-changing tool call the agent made while answering. */
export type AgentAction = {
  tool: string;
  summary: string;
};

export type ChatReply = {
  text: string;
  /** Populated when the agent changed data, so the UI can offer an undo. */
  actions: AgentAction[];
};

/**
 * Sends the conversation to Gemini, executing any tool calls it requests
 * against real budget data, and returns the final text reply along with any
 * changes the agent made.
 */
export async function sendChatMessage(
  apiKey: string,
  history: ChatMessage[],
  background = '',
): Promise<ChatReply> {
  if (!apiKey) {
    throw new Error('Gemini API key is not set.');
  }

  // What we already know about this person, pulled by relevance to what they
  // just asked. Never fatal: no memory means a normal answer.
  const lastUserMessage = [...history].reverse().find(m => m.role === 'user');
  const recalled = await recallMemories(lastUserMessage?.text ?? '');
  const memories = recalled.map(m => m.content);

  // Documents are only re-sent while they are still recent, measured back from
  // the end of the conversation. Without this every later message re-uploads
  // and re-bills the attachment, which a phone photo makes expensive fast;
  // older ones become a text note so the model still knows they existed.
  const keepFilesFrom = Math.max(
    0,
    history.length - ATTACHMENT_CONTEXT_MESSAGES,
  );

  const contents: GeminiContent[] = history.map((m, i) => ({
    role: m.role,
    parts: [
      ...(m.attachments ?? []).map(file =>
        i >= keepFilesFrom
          ? { inlineData: { mimeType: file.mimeType, data: file.data } }
          : { text: `[${file.name} — attached earlier and already read]` },
      ),
      ...(m.text ? [{ text: m.text }] : []),
    ],
  }));
  const actions: AgentAction[] = [];

  // Guard against infinite tool-call loops.
  for (let round = 0; round < 6; round++) {
    const data = await callGemini(apiKey, contents, memories, background);
    const candidate = data.candidates?.[0];
    const parts: GeminiPart[] = candidate?.content?.parts ?? [];

    const functionCalls = parts.filter(
      (p): p is Extract<GeminiPart, { functionCall: unknown }> =>
        'functionCall' in p,
    );

    if (functionCalls.length === 0) {
      return {
        text: parts
          .map(p => ('text' in p ? p.text : ''))
          .join('')
          .trim(),
        actions,
      };
    }

    contents.push({ role: 'model', parts });

    const responseParts: GeminiPart[] = [];
    for (const { functionCall } of functionCalls) {
      const outcome = await runTool(functionCall.name, functionCall.args || {});
      console.log(
        '[AI Assistant] tool call',
        functionCall.name,
        functionCall.args,
        '->',
        outcome,
      );

      if (MUTATING_TOOLS.has(functionCall.name) && 'result' in outcome) {
        const changed = (outcome.result as { changed?: string })?.changed;
        if (changed) {
          actions.push({ tool: functionCall.name, summary: changed });
        }
      }

      responseParts.push({
        functionResponse: {
          // Gemini tags each call with an id when it issues several at once;
          // echo it back so results are matched to the right call.
          ...(functionCall.id ? { id: functionCall.id } : {}),
          name: functionCall.name,
          response: outcome,
        },
      });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  console.warn(
    '[AI Assistant] gave up after too many tool-call rounds',
    contents,
  );
  return {
    text: 'That took too many steps to look up — try a narrower question (e.g. a specific month or category).',
    actions,
  };
}
