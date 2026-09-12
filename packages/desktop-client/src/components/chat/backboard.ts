// Persistent memory for the AI Assistant, backed by Backboard.
//
// Gemini remains the brain: Backboard is used only as the memory store. Before
// answering, relevant memories are searched and handed to Gemini as context;
// when the user states something durable about themselves, Gemini writes it
// back through the rememberAboutMe tool. That split keeps the budget tools and
// the conversation on Gemini while the things worth remembering outlive the
// tab.
//
// Memories are facts the user chose to share, not their financial data — no
// transactions, balances or budgets are ever sent here.
import { BACKBOARD_API_KEY } from './apiKeys';

const BASE = 'https://app.backboard.io/api';

// Which assistant profile these memories belong to. Kept per-device, the same
// way the rest of this build stores local state.
const ASSISTANT_ID_KEY = 'wayne.backboard.assistantId';

export type Memory = {
  id: string;
  content: string;
  score?: number | null;
  created_at?: string;
};

export function isMemoryEnabled() {
  return Boolean(BACKBOARD_API_KEY);
}

async function request(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': BACKBOARD_API_KEY,
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Backboard ${init.method || 'GET'} ${path} failed (${res.status}): ${body}`,
    );
  }

  return res.status === 204 ? null : res.json();
}

function readStoredAssistantId() {
  try {
    return window.localStorage.getItem(ASSISTANT_ID_KEY);
  } catch {
    // Private windows and blocked storage: memory just won't persist.
    return null;
  }
}

function storeAssistantId(id: string) {
  try {
    window.localStorage.setItem(ASSISTANT_ID_KEY, id);
  } catch {
    // Not fatal — this session still has memory, it just won't be reused.
  }
}

let assistantPromise: Promise<string | null> | null = null;

/** Resolves the assistant profile these memories hang off, creating it once. */
function ensureAssistant(): Promise<string | null> {
  assistantPromise ??= (async () => {
    if (!isMemoryEnabled()) {
      return null;
    }

    const existing = readStoredAssistantId();
    if (existing) {
      return existing;
    }

    const created = await request('/assistants', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Wayne Finance',
        system_prompt:
          "Remembers a person's financial goals, habits and preferences so a budgeting assistant can pick up where it left off.",
      }),
    });

    const id = created?.assistant_id;
    if (!id) {
      throw new Error('Backboard did not return an assistant_id.');
    }
    storeAssistantId(id);
    return id;
  })();

  return assistantPromise;
}

/**
 * Memories relevant to what the user just asked. Failure is never fatal: the
 * assistant answers without memory rather than not at all.
 */
export async function recallMemories(
  query: string,
  limit = 5,
): Promise<Memory[]> {
  if (!isMemoryEnabled() || !query.trim()) {
    return [];
  }

  try {
    const assistantId = await ensureAssistant();
    if (!assistantId) {
      return [];
    }

    const result = await request(`/assistants/${assistantId}/memories/search`, {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    });
    return (result?.memories ?? []) as Memory[];
  } catch (err) {
    console.warn('[AI Assistant] could not recall memories:', err);
    return [];
  }
}

/** Stores one durable fact about the user. */
export async function rememberFact(content: string): Promise<string> {
  if (!isMemoryEnabled()) {
    throw new Error('Memory is not configured — add a Backboard API key.');
  }

  const assistantId = await ensureAssistant();
  if (!assistantId) {
    throw new Error('Memory is not configured.');
  }

  await request(`/assistants/${assistantId}/memories`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      metadata: { source: 'wayne-finance', savedAt: new Date().toISOString() },
    }),
  });

  return content;
}

/** Everything remembered so far, for the "what it knows about you" panel. */
export async function listMemories(): Promise<Memory[]> {
  if (!isMemoryEnabled()) {
    return [];
  }

  try {
    const assistantId = await ensureAssistant();
    if (!assistantId) {
      return [];
    }
    const result = await request(`/assistants/${assistantId}/memories`);
    return (result?.memories ?? result ?? []) as Memory[];
  } catch (err) {
    console.warn('[AI Assistant] could not list memories:', err);
    return [];
  }
}

/** Forgets one fact. */
export async function forgetMemory(id: string) {
  const assistantId = await ensureAssistant();
  if (!assistantId) {
    return;
  }
  await request(`/assistants/${assistantId}/memories/${id}`, {
    method: 'DELETE',
  });
}
