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

import { ChatBubble } from './ChatBubble';
import { speak } from './elevenlabs';
import type { ChatMessage } from './gemini';
import { sendChatMessage } from './gemini';
import { InsightCard } from './InsightCard';
import { loadInsights } from './insights';

const SUGGESTIONS = [
  'How much did I spend this month?',
  'What bills are coming up?',
  'Am I on track with my budget?',
  "What's my net worth?",
];

export function Chat() {
  const { t } = useTranslation();
  const [geminiApiKey] = useGlobalPref('geminiApiKey');
  const [elevenLabsApiKey] = useGlobalPref('elevenLabsApiKey');
  const [elevenLabsVoiceId] = useGlobalPref('elevenLabsVoiceId');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      setMessages([...nextHistory, { role: 'model', text: reply }]);

      if (elevenLabsApiKey && !isMuted && reply) {
        void speak(elevenLabsApiKey, reply, elevenLabsVoiceId || undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

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
            <ChatBubble key={i} message={message} />
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
          <Button onPress={() => setIsMuted(m => !m)}>
            {isMuted ? t('🔇') : t('🔊')}
          </Button>
        </View>
      </View>
    </Page>
  );
}
