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
}

/** A small numeric input — used for focus/break minutes and a ritual's cycle target. Clearing the field commits null. */
export function NumberField({ label, value, onChange, min = 0, max = 999, unit, placeholder = '—' }: NumberFieldProps) {
  const theme = useTheme();

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
      <Text variant="label" color={theme.neutral.textMuted}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.xs }}>
        <TextInput
          value={value != null ? String(value) : ''}
          onChangeText={handleChangeText}
          keyboardType="number-pad"
          placeholder={placeholder}
          placeholderTextColor={theme.neutral.textMuted}
          style={{
            fontFamily: theme.fontFamily.displayMedium,
            fontSize: theme.fontSize.xl,
            color: theme.neutral.text,
            minWidth: 44,
            paddingVertical: theme.spacing.xs,
          }}
        />
        {unit ? (
          <Text variant="body" color={theme.neutral.textMuted}>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
