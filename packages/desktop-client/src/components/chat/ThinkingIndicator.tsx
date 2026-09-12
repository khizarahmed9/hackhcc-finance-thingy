import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

const DOTS = [0, 1, 2];

/**
 * Replaces the old "Thinking…" text bubble. A reply can take several tool-call
 * rounds, so this needs to read as the assistant working rather than as a
 * message that arrived.
 */
export function ThinkingIndicator() {
  const { t } = useTranslation();

  return (
    <View
      aria-live="polite"
      aria-label={t('Thinking')}
      style={{
        flexDirection: 'row',
        gap: 4,
        alignItems: 'center',
        padding: '6px 2px',
      }}
    >
      <style>
        {`@keyframes actual-chat-think {
            0%, 80%, 100% { opacity: 0.25; }
            40% { opacity: 0.9; }
          }
          @media (prefers-reduced-motion: reduce) {
            .actual-chat-think-dot { animation: none !important; opacity: 0.5; }
          }`}
      </style>
      {DOTS.map(i => (
        <View
          key={i}
          className="actual-chat-think-dot"
          style={{
            width: 5,
            height: 5,
            borderRadius: 5,
            backgroundColor: theme.pageTextSubdued,
            animation: 'actual-chat-think 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </View>
  );
}
