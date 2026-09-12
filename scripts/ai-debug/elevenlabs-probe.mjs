// Checks the ElevenLabs key and voice used by the AI Assistant, writing the
// synthesized audio to a file so it can be played back outside the browser.
//
//   node scripts/ai-debug/elevenlabs-probe.mjs "hello from actual budget"
//   node scripts/ai-debug/elevenlabs-probe.mjs --list-voices
//
// Mirrors packages/desktop-client/src/components/chat/elevenlabs.ts.
import fs from 'node:fs';

import { loadEnv, requireKey } from './env.mjs';

const env = loadEnv();
const API_KEY = requireKey('ELEVENLABS_API_KEY');
const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // "George"
const VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID ||
  env.ELEVENLABS_VOICE_ID ||
  DEFAULT_VOICE_ID;

async function listVoices() {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': API_KEY },
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`ListVoices failed (${res.status}):\n${body}`);
    process.exit(1);
  }
  for (const v of JSON.parse(body).voices ?? []) {
    console.log(`  ${v.voice_id}  ${v.name}`);
  }
}

async function speak(text) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': API_KEY },
      body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5' }),
    },
  );

  if (!res.ok) {
    console.error(`TTS failed (${res.status}):\n${await res.text()}`);
    process.exit(1);
  }

  const out = '/tmp/elevenlabs-probe.mp3';
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`voice ${VOICE_ID} ok — wrote ${out}`);
}

// Round-trips the exact pair the assistant uses: Turbo v2.5 out, Scribe back in.
async function roundTrip(text) {
  await speak(text);
  const audio = fs.readFileSync('/tmp/elevenlabs-probe.mp3');
  const form = new FormData();
  form.append('file', new Blob([audio], { type: 'audio/mpeg' }), 'probe.mp3');
  form.append('model_id', 'scribe_v1');

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY },
    body: form,
  });

  if (!res.ok) {
    console.error(`STT failed (${res.status}):\n${await res.text()}`);
    process.exit(1);
  }

  const { text: heard } = await res.json();
  console.log(`\nspoke: ${text}\nheard: ${heard}`);
}

const args = process.argv.slice(2);
const prompt = args.filter(a => !a.startsWith('--')).join(' ');
if (args.includes('--list-voices')) {
  await listVoices();
} else if (args.includes('--round-trip')) {
  await roundTrip(prompt || 'You overspent on groceries by twelve dollars.');
} else {
  await speak(prompt || 'Your grocery budget is over by twelve dollars.');
}
