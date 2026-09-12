import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import type { ChatMessage } from './gemini';

export function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <View
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        backgroundColor: isUser
          ? theme.buttonPrimaryBackground
          : theme.pillBackground,
        color: isUser ? theme.buttonPrimaryText : theme.pageText,
        borderRadius: 12,
        padding: '8px 12px',
        maxWidth: '80%',
        whiteSpace: 'pre-wrap',
      }}
    >
      <Text style={{ color: isUser ? theme.buttonPrimaryText : undefined }}>
        {message.text}
      </Text>
    </View>
  );
}
