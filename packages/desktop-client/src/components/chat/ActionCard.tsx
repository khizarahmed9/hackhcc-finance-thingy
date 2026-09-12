import { useState } from 'react';
import { Trans } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { undoLastAction } from './budgetActions';
import type { AgentAction } from './gemini';

type ActionCardProps = {
  actions: AgentAction[];
};

/**
 * Shown under a reply where the assistant changed data. Actions go through
 * Actual's normal undo stack, so one click puts everything back.
 */
export function ActionCard({ actions }: ActionCardProps) {
  const [isUndone, setIsUndone] = useState(false);

  async function handleUndo() {
    // One undo step per change the agent made, newest first.
    for (let i = 0; i < actions.length; i++) {
      await undoLastAction();
    }
    setIsUndone(true);
  }

  return (
    <View
      style={{
        gap: 6,
        padding: 10,
        borderRadius: 8,
        backgroundColor: theme.noticeBackground,
        border: `1px solid ${theme.noticeBorder}`,
      }}
    >
      {actions.map((action, i) => (
        <Text key={i} style={{ color: theme.noticeText, fontSize: 13 }}>
          {isUndone ? <s>{action.summary}</s> : action.summary}
        </Text>
      ))}

      {isUndone ? (
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          <Trans>Undone.</Trans>
        </Text>
      ) : (
        <View style={{ flexDirection: 'row' }}>
          <Button onPress={handleUndo}>
            <Trans>Undo</Trans>
          </Button>
        </View>
      )}
    </View>
  );
}
