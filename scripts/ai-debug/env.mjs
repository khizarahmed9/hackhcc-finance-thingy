// Minimal .env.local loader for the ai-debug scripts. No dependency on dotenv
// so these can run straight from a clean checkout.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

export function loadEnv(file = '.env.local') {
  const envPath = path.join(repoRoot, file);
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const env = {};
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) {
      env[key] = value;
    }
  }
  return env;
}

export function requireKey(name, file = '.env.local') {
  const value = process.env[name] || loadEnv(file)[name];
  if (!value) {
    console.error(
      `Missing ${name}. Add it to ${file} at the repo root (see .env.local.example).`,
    );
    process.exit(1);
  }
  return value;
}
