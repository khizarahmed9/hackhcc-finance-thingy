import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import {
  SvgMic,
  SvgSend,
  SvgVolumeOff,
  SvgVolumeUp,
} from '@actual-app/components/icons/v1';
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
import { ThinkingIndicator } from './ThinkingIndicator';
import { useVoice } from './useVoice';

// Two questions and two actions, so the empty state teaches that this
// assistant can change the budget and not only describe it.
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
  }, [messages, isLoading]);

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
        // The budget changed underneath the insights shown on this page.
        void loadInsights().then(setInsights);
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

  const { isNarrowWidth } = useResponsive();
  const isRecording = voice.state === 'recording';
  const voiceStatus = {
    idle: null,
    recording: t("Listening — press the mic again when you're done"),
    transcribing: t('Transcribing…'),
    speaking: t('Speaking — press the mic to interrupt'),
  }[voice.state];

  if (!geminiApiKey) {
    return (
      <Page header={t('Assistant')}>
        <View style={{ maxWidth: 440, gap: 12 }}>
          <Text style={{ lineHeight: 1.55 }}>
            <Trans>
              The assistant answers questions about your budget and can make
              changes for you. It needs a Google Gemini API key to run, and
              calls the API straight from this device — your financial data is
              never sent to a server of ours.
            </Trans>
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <Link variant="internal" to="/settings">
              <Trans>Add an API key in Settings</Trans>
            </Link>
          </View>
        </View>
      </Page>
    );
  }

  const isEmpty = messages.length === 0;

  return (
    <Page header={t('Assistant')}>
      <View
        style={{
          flex: 1,
          maxWidth: 720,
          width: '100%',
          gap: 16,
          paddingLeft: isNarrowWidth ? 16 : 0,
          paddingRight: isNarrowWidth ? 16 : 0,
        }}
      >
        <View
          innerRef={scrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {/* Anchors the conversation to the composer, so a short exchange
              doesn't leave a page-height gap above the input. */}
          <View style={{ marginTop: 'auto', gap: 16 }}>
            {isEmpty && (
              <View style={{ gap: 16, paddingTop: 4 }}>
                {insights.length > 0 && (
                  <View style={{ gap: 8 }}>
                    {insights.map((insight, i) => (
                      <InsightCard key={i}>{insight}</InsightCard>
                    ))}
                  </View>
                )}

                <View style={{ gap: 8 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      color: theme.pageTextSubdued,
                    }}
                  >
                    <Trans>Try asking</Trans>
                  </Text>
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
                  >
                    {SUGGESTIONS.map(suggestion => (
                      <Button
                        key={suggestion}
                        isDisabled={isLoading}
                        onPress={() => handleSend(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {messages.map((message, i) => (
              <View key={i} style={{ gap: 8 }}>
                <ChatBubble message={message} />
                {actionsByMessage[i] && (
                  <ActionCard actions={actionsByMessage[i]} />
                )}
              </View>
            ))}

            {isLoading && <ThinkingIndicator />}
          </View>
        </View>

        {error && (
          <Text
            role="alert"
            style={{ color: theme.errorText, fontSize: 13, lineHeight: 1.5 }}
          >
            {error}
          </Text>
        )}

        <View style={{ gap: 6 }}>
          {/* The three controls plus a field don't fit on a phone without
              clipping the placeholder, so the field takes its own row there. */}
          <View
            style={{
              flexDirection: isNarrowWidth ? 'column' : 'row',
              gap: 8,
              alignItems: isNarrowWidth ? 'stretch' : 'center',
            }}
          >
            <Input
              value={input}
              placeholder={
                isNarrowWidth
                  ? t('Ask or change something…')
                  : t('Ask a question, or tell it what to change…')
              }
              style={{ flex: 1 }}
              onChangeValue={setInput}
              onEnter={value => void handleSend(value)}
            />
            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                alignItems: 'center',
                justifyContent: isNarrowWidth ? 'flex-end' : 'flex-start',
              }}
            >
              <Button
                variant={isRecording ? 'primary' : 'normal'}
                isDisabled={!elevenLabsApiKey || voice.state === 'transcribing'}
                aria-label={isRecording ? t('Stop recording') : t('Speak')}
                aria-pressed={isRecording}
                onPress={voice.toggleListening}
              >
                <SvgMic style={{ width: 13, height: 13 }} />
              </Button>
              <Button
                aria-label={
                  isMuted
                    ? t('Turn on spoken replies')
                    : t('Mute spoken replies')
                }
                aria-pressed={isMuted}
                onPress={() => {
                  if (!isMuted) {
                    voice.stopSpeaking();
                  }
                  setIsMuted(m => !m);
                }}
              >
                {isMuted ? (
                  <SvgVolumeOff style={{ width: 13, height: 13 }} />
                ) : (
                  <SvgVolumeUp style={{ width: 13, height: 13 }} />
                )}
              </Button>
              <Button
                variant="primary"
                isDisabled={isLoading || !input.trim()}
                aria-label={t('Send')}
                onPress={() => handleSend(input)}
              >
                <SvgSend style={{ width: 13, height: 13 }} />
              </Button>
            </View>
          </View>

          <Text
            aria-live="polite"
            style={{
              fontSize: 12,
              color: theme.pageTextSubdued,
              minHeight: 16,
            }}
          >
            {voiceStatus}
          </Text>
        </View>
      </View>
    </Page>
  );
}
