import { View } from 'react-native';

import { Surface } from '@/components/Surface';
import { Text } from '@/components/Text';
import { formatFocusDuration, type BreakdownEntry } from '@/domain/stats/statsAggregation';
import { useTheme } from '@/theme/ThemeProvider';

export interface BreakdownListProps {
  title: string;
  /** Entries with a null key (no ritual/task) should already be filtered out by the caller. */
  entries: BreakdownEntry[];
  resolveLabel: (key: string) => string;
}

export function BreakdownList({ title, entries, resolveLabel }: BreakdownListProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="label" color={theme.neutral.textMuted}>
        {title}
      </Text>
      <Surface style={{ gap: theme.spacing.sm }}>
        {entries.map((entry) => (
          <View key={entry.key} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}>
            <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
              {entry.key ? resolveLabel(entry.key) : '—'}
            </Text>
            <Text variant="body" color={theme.neutral.textMuted}>
              {formatFocusDuration(entry.totalFocusMs)}
            </Text>
          </View>
        ))}
      </Surface>
    </View>
  );
}
