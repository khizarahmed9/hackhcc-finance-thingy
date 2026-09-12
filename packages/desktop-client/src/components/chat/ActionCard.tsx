import { useState } from 'react';
import { Trans } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgCheckCircle1 } from '@actual-app/components/icons/v2';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { undoLastAction } from './budgetActions';
import type { AgentAction } from './gemini';

type ActionCardProps = {
  actions: AgentAction[];
};

/**
 * Receipt for changes the assistant made to the budget. Actions run through
 * Actual's normal undo stack, so reverting them is one click — which is what
 * makes it reasonable to let the assistant act without a confirmation prompt
 * in front of every change.
 */
export function ActionCard({ actions }: ActionCardProps) {
  const [isUndone, setIsUndone] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  async function handleUndo() {
    setIsUndoing(true);
    try {
      // One undo step per change the assistant made, newest first.
      for (let i = 0; i < actions.length; i++) {
        await undoLastAction();
      }
      setIsUndone(true);
    } finally {
      setIsUndoing(false);
    }
  }

  return (
    <View
      style={{
        gap: 8,
        padding: '10px 12px',
        borderRadius: 6,
        backgroundColor: theme.tableBackground,
        border: `1px solid ${isUndone ? theme.tableBorder : theme.noticeBorder}`,
        opacity: isUndone ? 0.7 : 1,
        transition: 'opacity 150ms ease-out, border-color 150ms ease-out',
      }}
    >
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <SvgCheckCircle1
          aria-hidden="true"
          style={{
            width: 14,
            height: 14,
            flexShrink: 0,
            marginTop: 3,
            color: isUndone ? theme.pageTextSubdued : theme.noticeTextLight,
          }}
        />
        <View style={{ gap: 3, flex: 1 }}>
          {actions.map((action, i) => (
            <Text
              key={i}
              style={{
                ...styles.tnum,
                lineHeight: 1.5,
                textDecorationLine: isUndone ? 'line-through' : 'none',
                color: isUndone ? theme.pageTextSubdued : theme.pageText,
              }}
            >
              {action.summary}
            </Text>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {isUndone ? (
          <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
            <Trans>Reverted</Trans>
          </Text>
        ) : (
          <Button isDisabled={isUndoing} onPress={handleUndo}>
            {isUndoing ? <Trans>Undoing…</Trans> : <Trans>Undo</Trans>}
          </Button>
        )}
      </View>
    </View>
  );
}
