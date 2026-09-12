// Exercises the Backboard memory API the assistant uses: create an assistant,
// write a fact, search for it, list, then clean up.
//
//   node scripts/ai-debug/backboard-probe.mjs
//   node scripts/ai-debug/backboard-probe.mjs --keep   (don't delete what it wrote)
import { requireKey } from './env.mjs';

const API_KEY = requireKey('BACKBOARD_API_KEY');
const BASE = 'https://app.backboard.io/api';
const KEEP = process.argv.includes('--keep');

async function call(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, ok: res.ok, body };
}

const created = await call('/assistants', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Wayne Finance probe',
    system_prompt: 'Probe assistant for verifying the memory API.',
  }),
});
console.log(
  'create assistant :',
  created.status,
  created.ok ? 'ok' : JSON.stringify(created.body).slice(0, 200),
);
if (!created.ok) {
  process.exit(1);
}

const assistantId = created.body.assistant_id;
console.log('assistant_id     :', assistantId);

const facts = [
  'Is saving for a car deposit by June 2027.',
  'Gets paid on the 15th of each month.',
  'Prefers not to track spending on coffee.',
];
for (const fact of facts) {
  const added = await call(`/assistants/${assistantId}/memories`, {
    method: 'POST',
    body: JSON.stringify({ content: fact, metadata: { source: 'probe' } }),
  });
  console.log(
    'add memory       :',
    added.status,
    added.ok ? fact.slice(0, 40) : JSON.stringify(added.body).slice(0, 160),
  );
}

// Memory extraction can be asynchronous, so give it a moment before searching.
await new Promise(r => setTimeout(r, 4000));

const search = await call(`/assistants/${assistantId}/memories/search`, {
  method: 'POST',
  body: JSON.stringify({
    query: 'When am I paid and what am I saving for?',
    limit: 5,
  }),
});
console.log('\nsearch           :', search.status);
if (search.ok) {
  for (const m of search.body.memories ?? []) {
    console.log(`   ${(m.score ?? '').toString().padEnd(6)} ${m.content}`);
  }
  console.log('total_count      :', search.body.total_count);
} else {
  console.log('   ', JSON.stringify(search.body).slice(0, 250));
}

const list = await call(`/assistants/${assistantId}/memories`);
console.log(
  '\nlist             :',
  list.status,
  list.ok
    ? `${(list.body.memories ?? list.body ?? []).length} memories`
    : JSON.stringify(list.body).slice(0, 200),
);

if (!KEEP) {
  const del = await call(`/assistants/${assistantId}`, { method: 'DELETE' });
  console.log('cleanup assistant:', del.status);
} else {
  console.log('kept assistant   :', assistantId);
}
