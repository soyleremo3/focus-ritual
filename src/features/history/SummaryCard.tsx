import { Surface } from '@/components/Surface';
import { Text } from '@/components/Text';
import { formatFocusDuration, type StatsSummary } from '@/domain/stats/statsAggregation';
import { useTheme } from '@/theme/ThemeProvider';

export interface SummaryCardProps {
  label: string;
  summary: StatsSummary;
}

export function SummaryCard({ label, summary }: SummaryCardProps) {
  const theme = useTheme();
  return (
    <Surface style={{ flex: 1, gap: theme.spacing.xxs }}>
      <Text variant="label" color={theme.neutral.textMuted}>
        {label}
      </Text>
      <Text variant="title" style={{ fontSize: theme.fontSize.lg }}>
        {formatFocusDuration(summary.totalFocusMs)}
      </Text>
      <Text variant="body" color={theme.neutral.textMuted} style={{ fontSize: theme.fontSize.sm }}>
        {summary.sessionCount} session{summary.sessionCount === 1 ? '' : 's'}
      </Text>
    </Surface>
  );
}
