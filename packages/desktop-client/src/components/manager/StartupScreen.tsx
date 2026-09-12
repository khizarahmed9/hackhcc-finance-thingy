import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { BRAND } from '#brand';

/**
 * Shown for the moment between app boot and the budget opening. This build is
 * single-device, so there is no file picker or welcome flow to land on.
 */
export function StartupScreen() {
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <style>
        {`@keyframes wayne-pulse {
            0%, 100% { opacity: 0.45; }
            50% { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .wayne-mark { animation: none !important; opacity: 0.8; }
          }`}
      </style>
      <Text
        className="wayne-mark"
        style={{
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: theme.pageText,
          animation: 'wayne-pulse 1.6s ease-in-out infinite',
        }}
      >
        {BRAND.name}
      </Text>
      <Text style={{ fontSize: 13, color: theme.pageTextSubdued }}>
        {BRAND.tagline}
      </Text>
    </View>
  );
}
