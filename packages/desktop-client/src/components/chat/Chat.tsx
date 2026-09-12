import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { Link } from '#components/common/Link';
import { Page } from '#components/Page';
import { useGlobalPref } from '#hooks/useGlobalPref';

import { ActionCard } from './ActionCard';
import { ChatBubble } from './ChatBubble';
import type { AgentAction, ChatMessage } from './gemini';
import { sendChatMessage } from './gemini';
import { InsightCard } from './InsightCard';
import { loadInsights } from './insights';
import { useVoice } from './useVoice';

const SUGGESTIONS = [
  'How much did I spend this month?',
  'What bills are coming up?',
  'Cover my overspending this month',
  'Categorize my uncategorized transactions',
];

export function Chat() {
  const { t } = useTranslation();
  const [geminiApiKey] = useGlobalPref('geminiApiKey');
  const [elevenLabsApiKey] = useGlobalPref('elevenLabsApiKey');
  const [elevenLabsVoiceId] = useGlobalPref('elevenLabsVoiceId');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Keyed by the index of the model message the actions belong to.
  const [actionsByMessage, setActionsByMessage] = useState<
    Record<number, AgentAction[]>
  >({});
  const [insights, setInsights] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const voice = useVoice({
    apiKey: elevenLabsApiKey,
    voiceId: elevenLabsVoiceId,
    // handleSend is a hoisted declaration, so it is defined by the time the
    // user actually finishes speaking.
    onTranscript: text => void handleSend(text),
    onError: setError,
  });

  useEffect(() => {
    if (geminiApiKey) {
      void loadInsights().then(setInsights);
    }
  }, [geminiApiKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleSend(text: string) {
    const question = text.trim();
    if (!question || !geminiApiKey || isLoading) return;

    const nextHistory: ChatMessage[] = [
      ...messages,
      { role: 'user', text: question },
    ];
    setMessages(nextHistory);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const reply = await sendChatMessage(geminiApiKey, nextHistory);
      setMessages([...nextHistory, { role: 'model', text: reply.text }]);

      if (reply.actions.length > 0) {
        setActionsByMessage(prev => ({
          ...prev,
          [nextHistory.length]: reply.actions,
        }));
      }

      if (!isMuted) {
        void voice.say(reply.text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  const voiceStatus = {
    idle: null,
    recording: t("Listening… press Stop when you're done."),
    transcribing: t('Transcribing…'),
    speaking: t('Speaking… press the mic to interrupt.'),
  }[voice.state];

  if (!geminiApiKey) {
    return (
      <Page header={t('Assistant')}>
        <View style={{ maxWidth: 480, gap: 10 }}>
          <Text>
            <Trans>
              Add a Google Gemini API key in Settings to start chatting with
              your AI financial assistant.
            </Trans>
          </Text>
          <Link variant="internal" to="/settings">
            <Trans>Go to Settings</Trans>
          </Link>
        </View>
      </Page>
    );
  }

  return (
    <Page header={t('Assistant')}>
      <View
        style={{
          flex: 1,
          maxWidth: 700,
          width: '100%',
          gap: 12,
        }}
      >
        {insights.length > 0 && messages.length === 0 && (
          <View>
            {insights.map((insight, i) => (
              <InsightCard key={i}>{insight}</InsightCard>
            ))}
          </View>
        )}

        <View
          innerRef={scrollRef}
          style={{
            flex: 1,
            minHeight: 300,
            maxHeight: 480,
            overflowY: 'auto',
            gap: 8,
            padding: 4,
          }}
        >
          {messages.map((message, i) => (
            <View key={i} style={{ gap: 6 }}>
              <ChatBubble message={message} />
              {actionsByMessage[i] && (
                <ActionCard actions={actionsByMessage[i]} />
              )}
            </View>
          ))}
          {isLoading && (
            <ChatBubble message={{ role: 'model', text: t('Thinking…') }} />
          )}
        </View>

        {error && <Text style={{ color: theme.errorText }}>{error}</Text>}

        {messages.length === 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {SUGGESTIONS.map(suggestion => (
              <Button key={suggestion} onPress={() => handleSend(suggestion)}>
                {suggestion}
              </Button>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Input
            value={input}
            placeholder={t('Ask about your spending, budget, or bills…')}
            style={{ flex: 1 }}
            onChangeValue={setInput}
            onEnter={value => void handleSend(value)}
          />
          <Button
            variant="primary"
            isDisabled={isLoading || !input.trim()}
            onPress={() => handleSend(input)}
          >
            <Trans>Send</Trans>
          </Button>
          <Button
            variant={voice.state === 'recording' ? 'primary' : 'normal'}
            isDisabled={!elevenLabsApiKey || voice.state === 'transcribing'}
            onPress={voice.toggleListening}
          >
            {voice.state === 'recording' ? t('Stop') : t('🎙️')}
          </Button>
          <Button
            onPress={() => {
              if (!isMuted) {
                voice.stopSpeaking();
              }
              setIsMuted(m => !m);
            }}
          >
            {isMuted ? t('🔇') : t('🔊')}
          </Button>
        </View>

        {voiceStatus && (
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            {voiceStatus}
          </Text>
        )}
      </View>
    </Page>
  );
}
