import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDelete } from '@actual-app/components/icons/v0';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import {
  forgetMemory,
  isMemoryEnabled,
  listMemories,
} from '#components/chat/backboard';
import type { Memory } from '#components/chat/backboard';

import { Setting } from './UI';

/**
 * What the assistant has remembered about the user across sessions. Shown so
 * memory is inspectable rather than invisible: you can see every fact it kept
 * and remove any of them.
 */
export function MemorySettings() {
  const { t } = useTranslation();
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (isMemoryEnabled()) {
      void listMemories().then(setMemories);
    }
  }, []);

  if (!isMemoryEnabled()) {
    return null;
  }

  async function handleForget(id: string) {
    setBusyId(id);
    try {
      await forgetMemory(id);
      setMemories(current => (current ?? []).filter(m => m.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Setting>
      <Text>
        <Trans>
          <strong>Memory</strong> is what the assistant carries between
          conversations — goals, habits and preferences you have told it. Your
          transactions and balances are never stored here.
        </Trans>
      </Text>

      {memories === null && (
        <Text style={{ color: theme.pageTextSubdued, fontSize: 13 }}>
          <Trans>Loading…</Trans>
        </Text>
      )}

      {memories?.length === 0 && (
        <Text style={{ color: theme.pageTextSubdued, fontSize: 13 }}>
          <Trans>
            Nothing remembered yet. Tell the assistant something about your
            goals and it will still know next time.
          </Trans>
        </Text>
      )}

      {memories && memories.length > 0 && (
        <View style={{ gap: 6, maxWidth: 520 }}>
          {memories.map(memory => (
            <View
              key={memory.id}
              style={{
                flexDirection: 'row',
                gap: 10,
                alignItems: 'flex-start',
                padding: '8px 10px',
                borderRadius: 6,
                backgroundColor: theme.tableBackground,
                border: `1px solid ${theme.tableBorder}`,
              }}
            >
              <Text style={{ flex: 1, lineHeight: 1.5, fontSize: 13 }}>
                {memory.content}
              </Text>
              <Button
                variant="bare"
                isDisabled={busyId === memory.id}
                aria-label={t('Forget this')}
                onPress={() => handleForget(memory.id)}
              >
                <SvgDelete style={{ width: 8, height: 8 }} />
              </Button>
            </View>
          ))}
        </View>
      )}
    </Setting>
  );
}
