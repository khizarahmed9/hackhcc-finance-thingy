// Voice in and voice out for the AI Assistant, via ElevenLabs.
//
// Speech-to-text uses Scribe, text-to-speech uses Turbo v2.5 (picked for
// latency — this is a live conversation, not narration). Both are called
// directly from the browser with a user-supplied API key, so audio never
// passes through a server of ours.
const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // ElevenLabs default "George" voice
const TTS_MODEL = 'eleven_turbo_v2_5';
const STT_MODEL = 'scribe_v1';

/** Stand-in for the stop handle when there is nothing to interrupt. */
function noop() {
  return undefined;
}

export type SpeechHandle = {
  stop: () => void;
  /** Resolves when playback finishes, or immediately if it was stopped. */
  done: Promise<void>;
};

/** Strips markdown so the voice doesn't read "asterisk asterisk" out loud. */
function toSpokenText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .trim();
}

/**
 * Speaks `text` aloud. Returns a handle so the caller can interrupt playback —
 * important for a conversation, where the user may want to cut the reply off
 * and ask something else.
 */
function requestSpeech(apiKey: string, voiceId: string, text: string) {
  return fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=3`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: TTS_MODEL,
        voice_settings: { stability: 0.4, similarity_boost: 0.75 },
      }),
    },
  );
}

export async function speak(
  apiKey: string,
  text: string,
  voiceId: string = DEFAULT_VOICE_ID,
): Promise<SpeechHandle> {
  const spoken = toSpokenText(text);
  if (!spoken) {
    return { stop: noop, done: Promise.resolve() };
  }

  let res = await requestSpeech(apiKey, voiceId, spoken);

  // A voice id that isn't on this account shouldn't silence the assistant
  // entirely — fall back to the built-in voice and carry on.
  if (!res.ok && voiceId !== DEFAULT_VOICE_ID) {
    const body = await res
      .clone()
      .text()
      .catch(() => '');
    if (res.status === 400 || res.status === 404) {
      console.warn(
        `[AI Assistant] voice "${voiceId}" unavailable, using the default voice instead:`,
        body,
      );
      res = await requestSpeech(apiKey, DEFAULT_VOICE_ID, spoken);
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs speech failed (${res.status}): ${body}`);
  }

  const url = URL.createObjectURL(await res.blob());
  const audio = new Audio(url);

  let resolveDone: () => void;
  const done = new Promise<void>(resolve => {
    resolveDone = resolve;
  });

  const cleanup = () => {
    URL.revokeObjectURL(url);
    resolveDone();
  };
  audio.addEventListener('ended', cleanup);
  audio.addEventListener('error', cleanup);

  await audio.play();

  return {
    stop: () => {
      audio.pause();
      audio.currentTime = 0;
      cleanup();
    },
    done,
  };
}

/** Transcribes recorded audio to text with ElevenLabs Scribe. */
export async function transcribe(apiKey: string, audio: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', audio, 'recording.webm');
  form.append('model_id', STT_MODEL);

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs transcription failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return (data.text || '').trim();
}

export type Recorder = {
  /** Stops capture and resolves with the recorded audio. */
  stop: () => Promise<Blob>;
  /** Stops capture and discards the audio. */
  cancel: () => void;
};

/**
 * Starts microphone capture. Throws if the user denies permission, which the
 * caller should surface rather than failing silently.
 */
export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];

  recorder.addEventListener('dataavailable', event => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });
  recorder.start();

  const releaseMic = () => stream.getTracks().forEach(track => track.stop());

  return {
    stop: () =>
      new Promise<Blob>(resolve => {
        recorder.addEventListener('stop', () => {
          releaseMic();
          resolve(
            new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }),
          );
        });
        recorder.stop();
      }),
    cancel: () => {
      recorder.stop();
      releaseMic();
    },
  };
}
