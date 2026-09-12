import { useGlobalPref } from '#hooks/useGlobalPref';

/**
 * API keys for the AI Assistant.
 *
 * Keys come from .env.local at the repo root, injected at build time by
 * vite.config.mts, so one file serves both the app and scripts/ai-debug and
 * there's nothing to paste into Settings before demoing. Whatever is saved in
 * Settings is used when the build carries no key, which keeps the app usable
 * for anyone running it without a .env.local.
 *
 * Because these are inlined at build time, a deployed bundle carries them in
 * plain text — treat any build made with real keys as sensitive.
 */

const ENV_KEYS = {
  gemini: import.meta.env.KNIGHTFALL_GEMINI_API_KEY || '',
  elevenLabs: import.meta.env.KNIGHTFALL_ELEVENLABS_API_KEY || '',
  elevenLabsVoice: import.meta.env.KNIGHTFALL_ELEVENLABS_VOICE_ID || '',
} as const;

export type AssistantKeys = {
  geminiApiKey?: string;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  /** True when the build supplied the Gemini key, so Settings is informational. */
  isFromEnv: boolean;
};

export function useAssistantKeys(): AssistantKeys {
  const [geminiPref] = useGlobalPref('geminiApiKey');
  const [elevenLabsPref] = useGlobalPref('elevenLabsApiKey');
  const [voicePref] = useGlobalPref('elevenLabsVoiceId');

  return {
    geminiApiKey: ENV_KEYS.gemini || geminiPref,
    elevenLabsApiKey: ENV_KEYS.elevenLabs || elevenLabsPref,
    elevenLabsVoiceId: ENV_KEYS.elevenLabsVoice || voicePref,
    isFromEnv: Boolean(ENV_KEYS.gemini),
  };
}

/** Whether this build shipped with each key baked in. */
export const envKeyStatus = {
  gemini: Boolean(ENV_KEYS.gemini),
  elevenLabs: Boolean(ENV_KEYS.elevenLabs),
  elevenLabsVoice: Boolean(ENV_KEYS.elevenLabsVoice),
};
