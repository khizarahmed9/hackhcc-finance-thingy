// Client-side Gemini function-calling orchestration for the AI Assistant.
// Calls the Gemini REST API directly from the browser using a user-supplied
// API key (stored locally, see GlobalPrefs.geminiApiKey) — no server needed.
import { budgetToolDeclarations, budgetTools } from './budgetTools';
import type { BudgetToolName } from './budgetTools';

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type ChatRole = 'user' | 'model';

export type ChatMessage = {
  role: ChatRole;
  text: string;
};

const SYSTEM_INSTRUCTION = `You are a friendly, concise personal finance assistant built into the Actual Budget app.
You have tools to look up the user's real transactions, budgets, account balances, upcoming bills, and cash-flow forecasts — always call a tool instead of guessing when a question needs real numbers.
Today's date will be given to you in the first user turn if relevant. Format money as $X.XX. Keep answers short and actionable, and call out overspending or upcoming bills when relevant.`;

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | {
      functionResponse: {
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
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents,
      tools: [{ functionDeclarations: budgetToolDeclarations }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini request failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function runTool(name: string, args: Record<string, unknown>) {
  const tool = budgetTools[name as BudgetToolName];
  if (!tool) {
    return { error: `Unknown tool: ${name}` };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tool as (args: any) => Promise<unknown>)(args);
    return { result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Sends the conversation to Gemini, executing any tool calls it requests
 * against real budget data, and returns the final text reply.
 */
export async function sendChatMessage(
  apiKey: string,
  history: ChatMessage[],
): Promise<string> {
  if (!apiKey) {
    throw new Error('Gemini API key is not set.');
  }

  const contents: GeminiContent[] = history.map(m => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

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
      return parts
        .map(p => ('text' in p ? p.text : ''))
        .join('')
        .trim();
    }

    contents.push({ role: 'model', parts });

    const responseParts: GeminiPart[] = [];
    for (const { functionCall } of functionCalls) {
      const outcome = await runTool(functionCall.name, functionCall.args || {});
      responseParts.push({
        functionResponse: {
          name: functionCall.name,
          response: outcome,
        },
      });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  return "Sorry, I couldn't finish looking that up. Try asking again.";
}
