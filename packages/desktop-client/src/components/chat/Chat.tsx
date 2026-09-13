import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import {
  SvgAttachment,
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
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { Page } from '#components/Page';
import { useGlobalPref } from '#hooks/useGlobalPref';

import { ActionCard } from './ActionCard';
import { useAssistantKeys } from './apiKeys';
import { AttachmentChips } from './AttachmentChips';
import { ACCEPTED_TYPES, toAttachment } from './attachments';
import { ChatBubble } from './ChatBubble';
import type { AgentAction, Attachment, ChatMessage } from './gemini';
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
  const { geminiApiKey, elevenLabsApiKey, elevenLabsVoiceId } =
    useAssistantKeys();
  const [assistantBackground] = useGlobalPref('assistantBackground');

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
  const [pending, setPending] = useState<Attachment[]>([]);
  // Kept so a failed turn can be retried without retyping or re-attaching.
  const [retryable, setRetryable] = useState<ChatMessage | null>(null);
  const [isDropping, setIsDropping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    const files = pending;
    // A document on its own is a valid message; text is only required when
    // there is nothing attached.
    if ((!question && files.length === 0) || !geminiApiKey || isLoading) return;

    const turn: ChatMessage = {
      role: 'user',
      text: question || 'Read the attached document.',
      ...(files.length > 0 ? { attachments: files } : {}),
    };
    await send([...messages, turn], turn);
  }

  /** Retries the last turn that failed, reusing its text and attachments. */
  async function handleRetry() {
    if (!retryable || isLoading) return;
    await send([...messages], retryable);
  }

  async function send(nextHistory: ChatMessage[], turn: ChatMessage) {
    // On a retry the turn is already the last entry; on a fresh send it isn't.
    const withTurn =
      nextHistory[nextHistory.length - 1] === turn
        ? nextHistory
        : [...nextHistory, turn];

    setMessages(withTurn);
    setInput('');
    setPending([]);
    setIsLoading(true);
    setError(null);
    setRetryable(null);

    const geminiApiKeyValue = geminiApiKey;
    const nextHistoryFinal = withTurn;
    try {
      const reply = await sendChatMessage(
        geminiApiKeyValue as string,
        nextHistoryFinal,
        assistantBackground ?? '',
      );
      setMessages([...nextHistoryFinal, { role: 'model', text: reply.text }]);

      if (reply.actions.length > 0) {
        setActionsByMessage(prev => ({
          ...prev,
          [nextHistoryFinal.length]: reply.actions,
        }));
        // The budget changed underneath the insights shown on this page.
        void loadInsights().then(setInsights);
      }

      if (!isMuted) {
        void voice.say(reply.text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRetryable(turn);
    } finally {
      setIsLoading(false);
    }
  }

  function handleNewConversation() {
    voice.stopSpeaking();
    setMessages([]);
    setActionsByMessage({});
    setPending([]);
    setRetryable(null);
    setError(null);
    setInput('');
    void loadInsights().then(setInsights);
  }

  async function acceptFiles(list: FileList | File[] | null) {
    if (!list || list.length === 0) {
      return;
    }
    setError(null);
    const accepted: Attachment[] = [];
    for (const file of Array.from(list)) {
      try {
        accepted.push(await toAttachment(file));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
    if (accepted.length > 0) {
      setPending(prev => [...prev, ...accepted]);
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
        <View
          style={{
            maxWidth: 440,
            gap: 12,
            paddingLeft: isNarrowWidth ? 16 : 0,
            paddingRight: isNarrowWidth ? 16 : 0,
          }}
        >
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
        onDragOver={(e: DragEvent) => {
          e.preventDefault();
          setIsDropping(true);
        }}
        onDragLeave={() => setIsDropping(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          setIsDropping(false);
          void acceptFiles(e.dataTransfer?.files ?? null);
        }}
        style={{
          flex: 1,
          maxWidth: 720,
          width: '100%',
          gap: 16,
          paddingLeft: isNarrowWidth ? 16 : 0,
          paddingRight: isNarrowWidth ? 16 : 0,
          // Keep the composer clear of the mobile tab bar.
          paddingBottom: isNarrowWidth ? MOBILE_NAV_HEIGHT : 0,
          outline: isDropping ? `2px dashed ${theme.pageTextLink}` : 'none',
          outlineOffset: 4,
          borderRadius: 6,
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
              doesn't leave a page-height gap above the input.

              Everything in here sets flexShrink: 0. This is a flex column, so
              by default a tall reply gets compressed below the height its text
              needs; the text then paints outside its own box and over whatever
              follows instead of making the container scroll. */}
          <View style={{ marginTop: 'auto', gap: 16 }}>
            {isEmpty && (
              <View style={{ gap: 16, paddingTop: 4, flexShrink: 0 }}>
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
              <View key={i} style={{ gap: 8, flexShrink: 0 }}>
                {message.attachments && (
                  <View style={{ alignSelf: 'flex-end' }}>
                    <AttachmentChips attachments={message.attachments} />
                  </View>
                )}
                <ChatBubble message={message} />
                {actionsByMessage[i] && (
                  <ActionCard actions={actionsByMessage[i]} />
                )}
              </View>
            ))}

            {isLoading && <ThinkingIndicator />}

            {messages.length > 0 && !isLoading && (
              <View
                style={{ flexDirection: 'row', paddingTop: 4, flexShrink: 0 }}
              >
                <Button variant="bare" onPress={handleNewConversation}>
                  <Trans>New conversation</Trans>
                </Button>
              </View>
            )}
          </View>
        </View>

        {error && (
          <View
            role="alert"
            style={{
              flexDirection: 'row',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Text
              style={{ color: theme.errorText, fontSize: 13, lineHeight: 1.5 }}
            >
              {error}
            </Text>
            {retryable && (
              <Button isDisabled={isLoading} onPress={handleRetry}>
                <Trans>Try again</Trans>
              </Button>
            )}
          </View>
        )}

        <View style={{ gap: 6 }}>
          <AttachmentChips
            attachments={pending}
            onRemove={i => setPending(prev => prev.filter((_, n) => n !== i))}
          />

          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(',')}
            style={{ display: 'none' }}
            onChange={e => {
              void acceptFiles(e.target.files);
              // Allow re-picking the same file after removing it.
              e.target.value = '';
            }}
          />

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
              onChangeValue={value => {
                setInput(value);
                if (error) {
                  setError(null);
                }
              }}
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
                aria-label={t('Attach a receipt or statement')}
                isDisabled={isLoading}
                onPress={() => fileRef.current?.click()}
              >
                <SvgAttachment style={{ width: 13, height: 13 }} />
              </Button>
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
