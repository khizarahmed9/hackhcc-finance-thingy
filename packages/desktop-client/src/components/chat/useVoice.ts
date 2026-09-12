import { useCallback, useRef, useState } from 'react';

import type { Recorder, SpeechHandle } from './elevenlabs';
import { speak, startRecording, transcribe } from './elevenlabs';

export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'speaking';

type UseVoiceOptions = {
  apiKey?: string;
  voiceId?: string;
  /** Called with the transcript once the user finishes speaking. */
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
};

/**
 * Microphone capture plus spoken replies for the assistant.
 *
 * Recording and playback are mutually exclusive: starting a recording cuts off
 * whatever the assistant is currently saying, so the user can interrupt mid
 * sentence the way they would in a real conversation.
 */
export function useVoice({
  apiKey,
  voiceId,
  onTranscript,
  onError,
}: UseVoiceOptions) {
  const [state, setState] = useState<VoiceState>('idle');
  const recorderRef = useRef<Recorder | null>(null);
  const speechRef = useRef<SpeechHandle | null>(null);

  const stopSpeaking = useCallback(() => {
    speechRef.current?.stop();
    speechRef.current = null;
    setState(current => (current === 'speaking' ? 'idle' : current));
  }, []);

  const startListening = useCallback(async () => {
    if (!apiKey) {
      onError('Add an ElevenLabs API key in Settings to use voice.');
      return;
    }

    stopSpeaking();
    try {
      recorderRef.current = await startRecording();
      setState('recording');
    } catch {
      onError('Could not access the microphone — check browser permissions.');
      setState('idle');
    }
  }, [apiKey, onError, stopSpeaking]);

  const stopListening = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || !apiKey) {
      return;
    }
    recorderRef.current = null;
    setState('transcribing');

    try {
      const audio = await recorder.stop();
      const text = await transcribe(apiKey, audio);
      if (text) {
        onTranscript(text);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setState('idle');
    }
  }, [apiKey, onError, onTranscript]);

  const toggleListening = useCallback(() => {
    if (state === 'recording') {
      void stopListening();
    } else {
      void startListening();
    }
  }, [state, startListening, stopListening]);

  const say = useCallback(
    async (text: string) => {
      if (!apiKey || !text) {
        return;
      }
      try {
        stopSpeaking();
        setState('speaking');
        const handle = await speak(apiKey, text, voiceId || undefined);
        speechRef.current = handle;
        await handle.done;
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      } finally {
        speechRef.current = null;
        setState(current => (current === 'speaking' ? 'idle' : current));
      }
    },
    [apiKey, voiceId, onError, stopSpeaking],
  );

  return { state, toggleListening, stopSpeaking, say };
}
