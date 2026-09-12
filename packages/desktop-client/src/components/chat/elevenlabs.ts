// Speaks the AI Assistant's replies out loud via the ElevenLabs Text-to-Speech
// API. Called directly from the browser with a user-supplied API key.
const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // ElevenLabs default "George" voice

export async function speak(
  apiKey: string,
  text: string,
  voiceId: string = DEFAULT_VOICE_ID,
): Promise<HTMLAudioElement> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ElevenLabs request failed (${res.status}): ${body}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.addEventListener('ended', () => URL.revokeObjectURL(url));
  await audio.play();
  return audio;
}
