import { ScrollView } from 'react-native';

import { Chip } from '@/components/Chip';
import type { TimerMode } from '@/domain/timer/types';
import { useTheme } from '@/theme/ThemeProvider';

export const MODE_LABELS: Record<TimerMode, string> = {
  pomodoro: 'Pomodoro',
  deepWork: 'Deep Work',
  ninety: '90 Minute',
  custom: 'Custom',
  stopwatch: 'Stopwatch',
  flow: 'Flow',
};

const MODES = Object.keys(MODE_LABELS) as TimerMode[];

export interface ModePickerProps {
  selected: TimerMode;
  onSelect: (mode: TimerMode) => void;
  disabled?: boolean;
  accentColor: string;
  onAccentColor: string;
  mutedColor: string;
  borderColor: string;
}

export function ModePicker({
  selected,
  onSelect,
  disabled,
  accentColor,
  onAccentColor,
  mutedColor,
  borderColor,
}: ModePickerProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: theme.spacing.xs, paddingHorizontal: theme.spacing.lg }}
    >
      {MODES.map((mode) => (
        <Chip
          key={mode}
          label={MODE_LABELS[mode]}
          selected={mode === selected}
          disabled={disabled}
          onPress={() => onSelect(mode)}
          color={accentColor}
          onColor={onAccentColor}
          mutedColor={mutedColor}
          borderColor={borderColor}
        />
      ))}
    </ScrollView>
  );
}
