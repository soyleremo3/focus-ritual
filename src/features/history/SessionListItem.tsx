import { View } from 'react-native';

import { Surface } from '@/components/Surface';
import { Text } from '@/components/Text';
import { computeTotalFocusMs } from '@/domain/timer/timerEngine';
import type { TimerSession } from '@/domain/timer/types';
import { formatFocusDuration } from '@/domain/stats/statsAggregation';
import { MODE_LABELS } from '@/features/focus/ModePicker';
import { useTheme } from '@/theme/ThemeProvider';

export interface SessionListItemProps {
  session: TimerSession;
  /** Resolved ritual/task name, if this session was linked to one. */
  subtitle: string | null;
}

export function SessionListItem({ session, subtitle }: SessionListItemProps) {
  const theme = useTheme();
  const isCancelled = session.status === 'cancelled';
  const durationMs = computeTotalFocusMs(session, session.createdAt);
  const dateLabel = new Date(session.createdAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, opacity: isCancelled ? 0.6 : 1 }}>
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Text variant="body">{MODE_LABELS[session.mode]}</Text>
          {isCancelled && (
            <Text variant="label" color={theme.neutral.accent}>
              Cancelled
            </Text>
          )}
        </View>
        <Text variant="label" color={theme.neutral.textMuted} numberOfLines={1}>
          {[subtitle, dateLabel].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Text variant="body" color={theme.neutral.textMuted}>
        {formatFocusDuration(durationMs)}
      </Text>
    </Surface>
  );
}
