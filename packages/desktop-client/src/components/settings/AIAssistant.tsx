import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { envKeyStatus } from '#components/chat/apiKeys';
import { Link } from '#components/common/Link';
import { FormField, FormLabel } from '#components/forms';
import { useGlobalPref } from '#hooks/useGlobalPref';

import { Setting } from './UI';

/** Marks a field whose value this build already supplies. */
function SuppliedNote() {
  return (
    <Text style={{ fontSize: 12, marginTop: 2, color: theme.pageTextSubdued }}>
      <Trans>
        Supplied by this build&rsquo;s .env.local — anything entered here is
        ignored.
      </Trans>
    </Text>
  );
}

export function AIAssistantSettings() {
  const { t } = useTranslation();
  const [geminiApiKey, setGeminiApiKey] = useGlobalPref('geminiApiKey');
  const [elevenLabsApiKey, setElevenLabsApiKey] =
    useGlobalPref('elevenLabsApiKey');
  const [elevenLabsVoiceId, setElevenLabsVoiceId] =
    useGlobalPref('elevenLabsVoiceId');

  return (
    <Setting>
      <Text>
        <Trans>
          <strong>AI Assistant</strong> chats with you about your budget using
          Google Gemini, grounded in your real transactions and budget data.
          Replies can optionally be read aloud with ElevenLabs. Keys never leave
          this device.
        </Trans>
      </Text>
      <View style={{ gap: 10, maxWidth: 400 }}>
        <FormField>
          <FormLabel title={t('Gemini API key')} htmlFor="gemini-api-key" />
          <Input
            id="gemini-api-key"
            type="password"
            value={geminiApiKey || ''}
            placeholder={
              envKeyStatus.gemini
                ? t('Set in .env.local')
                : t('Paste your Gemini API key')
            }
            disabled={envKeyStatus.gemini}
            onChangeValue={value => setGeminiApiKey(value || undefined)}
          />
          {envKeyStatus.gemini ? (
            <SuppliedNote />
          ) : (
            <Text style={{ fontSize: 12, marginTop: 2 }}>
              <Link
                variant="external"
                to="https://aistudio.google.com/apikey"
                linkColor="purple"
              >
                <Trans>Get a free Gemini API key</Trans>
              </Link>
            </Text>
          )}
        </FormField>
        <FormField>
          <FormLabel
            title={t('ElevenLabs API key (optional, for voice replies)')}
            htmlFor="elevenlabs-api-key"
          />
          <Input
            id="elevenlabs-api-key"
            type="password"
            value={elevenLabsApiKey || ''}
            placeholder={
              envKeyStatus.elevenLabs
                ? t('Set in .env.local')
                : t('Paste your ElevenLabs API key')
            }
            disabled={envKeyStatus.elevenLabs}
            onChangeValue={value => setElevenLabsApiKey(value || undefined)}
          />
          {envKeyStatus.elevenLabs && <SuppliedNote />}
        </FormField>
        <FormField>
          <FormLabel
            title={t('ElevenLabs voice ID (optional)')}
            htmlFor="elevenlabs-voice-id"
          />
          <Input
            id="elevenlabs-voice-id"
            value={elevenLabsVoiceId || ''}
            placeholder={
              envKeyStatus.elevenLabsVoice
                ? t('Set in .env.local')
                : t('Defaults to a standard voice')
            }
            disabled={envKeyStatus.elevenLabsVoice}
            onChangeValue={value => setElevenLabsVoiceId(value || undefined)}
          />
          {envKeyStatus.elevenLabsVoice && <SuppliedNote />}
        </FormField>
      </View>
    </Setting>
  );
}
