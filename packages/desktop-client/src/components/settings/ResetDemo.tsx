import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import {
  closeBudget,
  createBudget,
  deleteBudget,
} from '#budgetfiles/budgetfilesSlice';
import { useMetadataPref } from '#hooks/useMetadataPref';
import { useNavigate } from '#hooks/useNavigate';
import { useDispatch } from '#redux';

import { Setting } from './UI';

/**
 * Throws away the current budget and seeds a fresh demo one.
 *
 * This build opens straight into demo data and is meant to be handed to
 * strangers, so there needs to be a way back after someone has moved money
 * around. Destructive, hence the two-step confirm rather than a modal.
 */
export function ResetDemoSettings() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [budgetId] = useMetadataPref('id');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  async function handleReset() {
    setIsResetting(true);
    try {
      const id = budgetId;
      await dispatch(closeBudget());
      if (id) {
        await dispatch(deleteBudget({ id }));
      }
      await dispatch(createBudget({ testMode: true }));
      // Starting over should land on the fresh budget, not back in Settings.
      void navigate('/budget');
    } catch {
      // Reloading recovers whatever state the failure left behind.
      window.location.reload();
    }
  }

  return (
    <Setting>
      <Text>
        <Trans>
          <strong>Start over</strong> replaces everything with a fresh demo
          budget. Use it after someone else has been exploring, or between runs
          of a demo. The current budget and every change made to it are deleted.
        </Trans>
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        {isConfirming ? (
          <>
            <Button
              variant="primary"
              isDisabled={isResetting}
              onPress={handleReset}
            >
              {isResetting ? (
                <Trans>Resetting…</Trans>
              ) : (
                <Trans>Yes, delete it and start fresh</Trans>
              )}
            </Button>
            <Button
              isDisabled={isResetting}
              onPress={() => setIsConfirming(false)}
            >
              <Trans>Cancel</Trans>
            </Button>
          </>
        ) : (
          <Button onPress={() => setIsConfirming(true)}>
            <Trans>Reset to a fresh demo budget</Trans>
          </Button>
        )}
      </View>

      {isConfirming && !isResetting && (
        <Text style={{ fontSize: 13, color: theme.errorText }}>
          <Trans>This cannot be undone.</Trans>
        </Text>
      )}
    </Setting>
  );
}
