import React, { useEffect, useRef } from 'react';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { setAppState } from '#app/appSlice';
import { createBudget, loadBudget } from '#budgetfiles/budgetfilesSlice';
import { AppBackground } from '#components/AppBackground';
import { Notifications } from '#components/Notifications';
import { useMetaThemeColor } from '#hooks/useMetaThemeColor';
import { useDispatch, useSelector } from '#redux';
import { loggedIn } from '#users/usersSlice';

import { StartupScreen } from './StartupScreen';

export function ManagementApp() {
  useMetaThemeColor(theme.mobileConfigServerViewTheme);

  const files = useSelector(state => state.budgetfiles.allFiles);
  const isLoading = useSelector(state => state.app.loadingText !== null);

  const managerHasInitialized = useSelector(
    state => state.app.managerHasInitialized,
  );

  const dispatch = useDispatch();

  // runs on mount only
  useEffect(() => {
    async function fetchData() {
      await dispatch(loggedIn());
      dispatch(setAppState({ managerHasInitialized: true }));
    }

    void fetchData();
  }, [dispatch]);

  // Single-device build: there is no file manager and no welcome screen. Open
  // the existing budget, or seed the demo one on a fresh install, so the app
  // lands straight on the budget.
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (
      !managerHasInitialized ||
      isLoading ||
      !files ||
      hasAutoOpened.current
    ) {
      return;
    }
    hasAutoOpened.current = true;

    // Remote files have no local id to open; this build is local-only anyway.
    const local = files.find(file => 'id' in file);
    if (local && 'id' in local) {
      void dispatch(loadBudget({ id: local.id }));
    } else {
      void dispatch(createBudget({ testMode: true }));
    }
  }, [dispatch, managerHasInitialized, isLoading, files]);

  return (
    <View style={{ height: '100%', color: theme.pageText }}>
      <AppBackground />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 40,
          WebkitAppRegion: 'drag',
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 40,
          right: 15,
        }}
      >
        <Notifications
          style={{
            position: 'relative',
            left: 'initial',
            right: 'initial',
          }}
        />
      </View>

      {managerHasInitialized && !isLoading && (
        <View
          style={{
            alignItems: 'center',
            bottom: 0,
            justifyContent: 'center',
            left: 0,
            padding: 20,
            position: 'absolute',
            right: 0,
            top: 0,
          }}
        >
          {/* The budget opens automatically, so this is only ever the brief
              moment before it does. */}
          <StartupScreen />
        </View>
      )}
    </View>
  );
}
