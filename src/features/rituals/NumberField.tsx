import { TextInput, View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface NumberFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  unit?: string;
  placeholder?: string;
  /** Explicit overrides — pass scene-palette colors when used over a Focus Space backdrop. */
  textColor?: string;
  mutedColor?: string;
}

/** A small numeric input — used for focus/break minutes and a ritual's cycle target. Clearing the field commits null. */
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  unit,
  placeholder = '—',
  textColor,
  mutedColor,
}: NumberFieldProps) {
  const theme = useTheme();
  const resolvedText = textColor ?? theme.neutral.text;
  const resolvedMuted = mutedColor ?? theme.neutral.textMuted;

  const handleChangeText = (text: string) => {
    const digitsOnly = text.replace(/[^0-9]/g, '');
    if (digitsOnly === '') {
      onChange(null);
      return;
    }
    onChange(Math.min(max, Math.max(min, parseInt(digitsOnly, 10))));
  };

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="label" color={resolvedMuted}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.xs }}>
        <TextInput
          value={value != null ? String(value) : ''}
          onChangeText={handleChangeText}
          keyboardType="number-pad"
          placeholder={placeholder}
          placeholderTextColor={resolvedMuted}
          style={{
            fontFamily: theme.fontFamily.displayMedium,
            fontSize: theme.fontSize.xl,
            color: resolvedText,
            minWidth: 44,
            paddingVertical: theme.spacing.xs,
          }}
        />
        {unit ? (
          <Text variant="body" color={resolvedMuted}>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
