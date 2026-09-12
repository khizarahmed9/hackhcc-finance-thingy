import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Route, Routes, useLocation } from 'react-router';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { SvgArrowLeft } from '@actual-app/components/icons/v1';
import { SvgNavigationMenu } from '@actual-app/components/icons/v2';
import { SpaceBetween } from '@actual-app/components/space-between';
import type { CSSProperties } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as Platform from '@actual-app/core/shared/platform';

import { SharedArrayBufferWarning } from '#components/SharedArrayBufferWarning';
import { useGlobalPref } from '#hooks/useGlobalPref';
import { useNavigate } from '#hooks/useNavigate';
import { useSheetValue } from '#hooks/useSheetValue';
import * as bindings from '#spreadsheet/bindings';

import { AccountSyncCheck } from './accounts/AccountSyncCheck';
import { Link } from './common/Link';
import { useSidebar } from './sidebar/SidebarProvider';

function UncategorizedButton() {
  const count: number | null = useSheetValue(bindings.uncategorizedCount());
  if (count === null || count <= 0) {
    return null;
  }

  return (
    <Link
      variant="button"
      buttonVariant="bare"
      to="/categories/uncategorized"
      style={{
        color: theme.errorText,
      }}
    >
      <Trans count={count}>{{ count }} uncategorized transactions</Trans>
    </Link>
  );
}

type TitlebarProps = {
  style?: CSSProperties;
};

export function Titlebar({ style }: TitlebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const sidebar = useSidebar();
  const { isNarrowWidth } = useResponsive();
  const [floatingSidebar] = useGlobalPref('floatingSidebar');

  return isNarrowWidth ? null : (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: '0 10px 0 15px',
        height: 36,
        pointerEvents: 'none',
        '& *': {
          pointerEvents: 'auto',
        },
        ...(!Platform.isBrowser && Platform.OS === 'mac' && floatingSidebar
          ? { paddingLeft: 80 }
          : {}),
        ...style,
      }}
    >
      {(floatingSidebar || sidebar.alwaysFloats) && (
        <Button
          aria-label={t('Sidebar menu')}
          variant="bare"
          style={{ marginRight: 8 }}
          onHoverStart={e => {
            if (e.pointerType === 'mouse') {
              sidebar.setHidden(false);
            }
          }}
          onPress={e => {
            if (e.pointerType !== 'mouse') {
              sidebar.setHidden(!sidebar.hidden);
            }
          }}
        >
          <SvgNavigationMenu
            className="menu"
            style={{ width: 15, height: 15, left: 0 }}
          />
        </Button>
      )}

      <Routes>
        <Route
          path="*"
          element={
            location.state?.goBack ? (
              <Button variant="bare" onPress={() => navigate(-1)}>
                <SvgArrowLeft
                  width={10}
                  height={10}
                  style={{ marginRight: 5 }}
                />{' '}
                <Trans>Back</Trans>
              </Button>
            ) : null
          }
        />

        <Route path="/accounts/:id" element={<AccountSyncCheck />} />
      </Routes>
      <View style={{ flex: 1 }} />
      {/* Only the uncategorized count earns a spot here: it tells you
          something actionable. The privacy eye, notifications bell and dev
          theme switcher were unlabeled icons that invited a misclick. */}
      <SpaceBetween gap={10}>
        <UncategorizedButton />
        <SharedArrayBufferWarning />
      </SpaceBetween>
    </View>
  );
}
