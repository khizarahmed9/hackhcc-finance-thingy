import type { ReactNode } from 'react';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

// The model answers in light markdown — bold for emphasis, dashes or asterisks
// for lists. Rendering it as raw text leaks the syntax into the UI, and a full
// markdown library is far more than these replies need.
const BOLD = /\*\*(.+?)\*\*/g;
// Money as the model writes it: $1,234.56, -$40, $12.83. The split pattern is
// global so it captures delimiters; the test pattern is deliberately not, since
// `.test()` on a global regex advances lastIndex between calls.
const MONEY_SPLIT = /(-?\$[\d,]+(?:\.\d{2})?)/g;
const IS_MONEY = /^-?\$[\d,]+(?:\.\d{2})?$/;

/**
 * Renders one inline run, giving every financial figure tabular numerals so
 * amounts stay column-aligned and unambiguous (DESIGN.md's Tabular Number
 * Rule), and resolving bold spans to weight rather than asterisks.
 */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  BOLD.lastIndex = 0;
  while ((match = BOLD.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(...money(text.slice(cursor, match.index), `${keyPrefix}-p`));
    }
    nodes.push(
      <Text key={`${keyPrefix}-b${match.index}`} style={{ fontWeight: 600 }}>
        {money(match[1], `${keyPrefix}-b${match.index}-m`)}
      </Text>,
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    nodes.push(...money(text.slice(cursor), `${keyPrefix}-t`));
  }
  return nodes;
}

function money(text: string, keyPrefix: string): ReactNode[] {
  return text.split(MONEY_SPLIT).map((part, i) =>
    IS_MONEY.test(part) ? (
      <Text key={`${keyPrefix}-${i}`} style={styles.tnum}>
        {part}
      </Text>
    ) : (
      part
    ),
  );
}

export function MessageText({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <View style={{ gap: 6 }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return null;
        }

        const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
        if (bullet) {
          return (
            <View
              key={i}
              style={{ flexDirection: 'row', gap: 8, paddingLeft: 2 }}
            >
              <Text
                aria-hidden="true"
                style={{ color: theme.pageTextSubdued, lineHeight: 1.55 }}
              >
                •
              </Text>
              <Text style={{ lineHeight: 1.55, flex: 1 }}>
                {inline(bullet[1], `l${i}`)}
              </Text>
            </View>
          );
        }

        const heading = trimmed.match(/^#{1,6}\s+(.*)$/);
        if (heading) {
          return (
            <Text key={i} style={{ fontWeight: 600, marginTop: 2 }}>
              {inline(heading[1], `l${i}`)}
            </Text>
          );
        }

        return (
          <Text key={i} style={{ lineHeight: 1.55 }}>
            {inline(trimmed, `l${i}`)}
          </Text>
        );
      })}
    </View>
  );
}
