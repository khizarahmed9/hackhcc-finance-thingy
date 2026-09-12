# ai-debug

Throwaway CLI probes for the AI Assistant's external APIs, so they can be
exercised without loading the app or reading the browser console.

## Setup

Put your keys in `.env.local` at the repo root (gitignored; copy
`.env.local.example`):

```
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
```

## Gemini

```bash
# Which models does this key actually have access to?
node scripts/ai-debug/gemini-probe.mjs --list-models

# Replay the assistant's tool-call loop with stubbed budget data, dumping the
# full raw response for every round (finishReason, parts, usage).
node scripts/ai-debug/gemini-probe.mjs "how much did I spend on groceries last month?"

# Try a different model without editing the app
GEMINI_MODEL=gemini-3.6-pro node scripts/ai-debug/gemini-probe.mjs "am I on track?"
```

The request shape mirrors
`packages/desktop-client/src/components/chat/gemini.ts`; the tools return
canned data instead of hitting the budget database. If the loop burns all six
rounds here, the bug is in the prompt/protocol rather than in the data layer.

## ElevenLabs

```bash
node scripts/ai-debug/elevenlabs-probe.mjs --list-voices
node scripts/ai-debug/elevenlabs-probe.mjs "test sentence"   # writes /tmp/elevenlabs-probe.mp3
```
