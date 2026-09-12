// Client-side Gemini function-calling orchestration for the AI Assistant.
// Calls the Gemini REST API directly from the browser using a user-supplied
// API key (stored locally, see GlobalPrefs.geminiApiKey) — no server needed.
import * as monthUtils from '@actual-app/core/shared/months';

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
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type ChatRole = 'user' | 'model';

export type ChatMessage = {
  role: ChatRole;
  text: string;
};

// The date has to be stated explicitly: without it the model burns tool-call
// rounds probing date-revealing tools (upcoming bills, forecasts, balances)
// just to work out what "last month" means, and often never converges.
function buildSystemInstruction() {
  return `You are a friendly, concise personal finance assistant built into the Actual Budget app.
You have tools to look up the user's real transactions, budgets, account balances, upcoming bills, and cash-flow forecasts — always call a tool instead of guessing when a question needs real numbers.
Today's date is ${monthUtils.currentDay()}. Resolve relative dates like "last month" or "this year" against it yourself; never call a tool just to discover the current date.

You can also CHANGE the budget: set budgeted amounts, move money between categories, categorize transactions, and cover overspending. Rules for acting:
- Act when the user clearly asks you to ("budget $300 for groceries", "move $50 from dining to gas", "categorize my Kroger transactions"). Do it, then say plainly what you changed.
- Do not make changes the user did not ask for. If a request is ambiguous about amount, category, or month, ask one short question first.
- Every change can be undone by the user, so don't hedge or ask for confirmation twice.
- After changing something, state the new state in one sentence.

Format money as $X.XX. Keep answers short and actionable, and call out overspending or upcoming bills when relevant.`;
}

type GeminiPart =
  | { text: string }
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

async function callGemini(apiKey: string, contents: GeminiContent[]) {
  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemInstruction() }] },
      contents,
      tools: [{ functionDeclarations: allDeclarations }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini request failed (${res.status}): ${body}`);
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
): Promise<ChatReply> {
  if (!apiKey) {
    throw new Error('Gemini API key is not set.');
  }

  const contents: GeminiContent[] = history.map(m => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));
  const actions: AgentAction[] = [];

  // Guard against infinite tool-call loops.
  for (let round = 0; round < 6; round++) {
    const data = await callGemini(apiKey, contents);
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
