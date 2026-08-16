import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

export interface EmptyStateProps {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  message?: string;
}

export function EmptyState({ icon = 'clock', title, message }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.xl,
        gap: theme.spacing.sm,
      }}
    >
      <Feather name={icon} size={28} color={theme.neutral.textMuted} />
      <Text variant="title" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {message ? (
        <Text variant="body" color={theme.neutral.textMuted} style={{ textAlign: 'center' }}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}
