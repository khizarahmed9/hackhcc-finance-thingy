import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { Link } from '#components/common/Link';
import { FormField, FormLabel } from '#components/forms';
import { useGlobalPref } from '#hooks/useGlobalPref';

import { Setting } from './UI';

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
          Replies can optionally be read aloud with ElevenLabs. Keys are stored
          locally on this device only.
        </Trans>
      </Text>
      <View style={{ gap: 10, maxWidth: 400 }}>
        <FormField>
          <FormLabel title={t('Gemini API key')} htmlFor="gemini-api-key" />
          <Input
            id="gemini-api-key"
            type="password"
            value={geminiApiKey || ''}
            placeholder={t('Paste your Gemini API key')}
            onChangeValue={value => setGeminiApiKey(value || undefined)}
          />
          <Text style={{ fontSize: 12, marginTop: 2 }}>
            <Link
              variant="external"
              to="https://aistudio.google.com/apikey"
              linkColor="purple"
            >
              <Trans>Get a free Gemini API key</Trans>
            </Link>
          </Text>
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
            placeholder={t('Paste your ElevenLabs API key')}
            onChangeValue={value => setElevenLabsApiKey(value || undefined)}
          />
        </FormField>
        <FormField>
          <FormLabel
            title={t('ElevenLabs voice ID (optional)')}
            htmlFor="elevenlabs-voice-id"
          />
          <Input
            id="elevenlabs-voice-id"
            value={elevenLabsVoiceId || ''}
            placeholder={t('Defaults to a standard voice')}
            onChangeValue={value => setElevenLabsVoiceId(value || undefined)}
          />
        </FormField>
      </View>
    </Setting>
  );
}
