import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDelete } from '@actual-app/components/icons/v0';
import { SvgAttachment } from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import type { Attachment } from './gemini';

type AttachmentChipsProps = {
  attachments: Attachment[];
  onRemove?: (index: number) => void;
};

/** The documents staged on a message, before or after it is sent. */
export function AttachmentChips({
  attachments,
  onRemove,
}: AttachmentChipsProps) {
  const { t } = useTranslation();

  if (attachments.length === 0) {
    return null;
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {attachments.map((file, i) => (
        <View
          key={`${file.name}-${i}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            padding: '3px 8px',
            borderRadius: 4,
            backgroundColor: theme.pillBackground,
            border: `1px solid ${theme.pillBorder}`,
            maxWidth: 240,
          }}
        >
          <SvgAttachment
            aria-hidden="true"
            style={{ width: 11, height: 11, flexShrink: 0 }}
          />
          <Text
            style={{
              fontSize: 12,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {file.name}
          </Text>
          {onRemove && (
            <Button
              variant="bare"
              aria-label={t('Remove {{name}}', { name: file.name })}
              style={{ padding: 2, flexShrink: 0 }}
              onPress={() => onRemove(i)}
            >
              <SvgDelete style={{ width: 7, height: 7 }} />
            </Button>
          )}
        </View>
      ))}
    </View>
  );
}
