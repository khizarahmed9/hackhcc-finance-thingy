import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import type { ChatMessage } from './gemini';
import { MessageText } from './MessageText';

/**
 * One turn of the conversation. The user's own words sit in a filled bubble;
 * the assistant answers on the page surface itself, so replies read like the
 * app talking rather than a second chat participant.
 */
export function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <View
        style={{
          alignSelf: 'flex-end',
          maxWidth: '85%',
          backgroundColor: theme.buttonPrimaryBackground,
          borderRadius: 14,
          borderBottomRightRadius: 4,
          padding: '8px 14px',
        }}
      >
        <Text style={{ color: theme.buttonPrimaryText, lineHeight: 1.5 }}>
          {message.text}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ alignSelf: 'stretch', paddingRight: 24 }}>
      <MessageText text={message.text} />
    </View>
  );
}
