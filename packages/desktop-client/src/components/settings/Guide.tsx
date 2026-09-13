import React from 'react';
import { Trans } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';

import { Setting } from './UI';

/**
 * Reopens the first-run guide. It shows itself once per device, so this is the
 * way back to it — and the way to show it to someone else on your machine.
 */
export function GuideSettings() {
  return (
    <Setting>
      <Text>
        <Trans>
          <strong>Guide</strong> explains what each part of the app is for, in
          plain language. It appears the first time you open the app on a
          device.
        </Trans>
      </Text>
      <View style={{ flexDirection: 'row' }}>
        <Button
          onPress={() => window.dispatchEvent(new Event('wayne:open-guide'))}
        >
          <Trans>Show the guide</Trans>
        </Button>
      </View>
    </Setting>
  );
}
