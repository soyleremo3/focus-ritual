import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { Surface } from '@/components/Surface';
import { Text } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import type { AppSettings } from '@/db/repositories/settingsRepo';
import { NumberField } from '@/features/rituals/NumberField';
import * as haptics from '@/lib/haptics';
import { useSettingsStore } from '@/store/settingsStore';
import { resyncCurrentNotification } from '@/store/timerStore';
import { useTheme } from '@/theme/ThemeProvider';

const THEME_OPTIONS: { value: AppSettings['themeMode']; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const WEEK_START_OPTIONS: { value: AppSettings['weekStartsOn']; label: string }[] = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="label" color={theme.neutral.textMuted}>
        {title}
      </Text>
      <Surface style={{ gap: theme.spacing.md }}>{children}</Surface>
    </View>
  );
}

interface SettingRowProps {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}

function SettingRow({ label, description, value, onValueChange }: SettingRowProps) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="body">{label}</Text>
        <Text variant="body" color={theme.neutral.textMuted} style={{ fontSize: theme.fontSize.sm }}>
          {description}
        </Text>
      </View>
      <Toggle
        value={value}
        label={label}
        onValueChange={(next) => {
          haptics.select();
          onValueChange(next);
        }}
      />
    </View>
  );
}

export function SettingsScreen() {
  const theme = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  // NumberField needs a local draft (not the store value directly) so the field can go
  // briefly empty while the user is typing/clearing a digit without snapping back —
  // same reason RitualEditorScreen holds its duration fields locally. Only re-synced when
  // the *persisted* value actually changes (e.g. hydrate() resolving after first paint),
  // never on every keystroke of its own write-back below.
  const [focusDraft, setFocusDraft] = useState<number | null>(settings.defaultFocusMinutes);
  const [breakDraft, setBreakDraft] = useState<number | null>(settings.defaultBreakMinutes);

  useEffect(() => {
    setFocusDraft(settings.defaultFocusMinutes);
  }, [settings.defaultFocusMinutes]);

  useEffect(() => {
    setBreakDraft(settings.defaultBreakMinutes);
  }, [settings.defaultBreakMinutes]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: theme.spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="title">Settings</Text>

        <Section title="Appearance">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {THEME_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={settings.themeMode === option.value}
                onPress={() => {
                  haptics.select();
                  void update({ themeMode: option.value });
                }}
              />
            ))}
          </View>
        </Section>

        <Section title="Timer Defaults">
          <Text variant="body" color={theme.neutral.textMuted} style={{ fontSize: theme.fontSize.sm }}>
            Used when starting Custom mode without a ritual
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.xl }}>
            <NumberField
              label="Focus"
              value={focusDraft}
              onChange={(next) => {
                setFocusDraft(next);
                if (next != null) void update({ defaultFocusMinutes: next });
              }}
              min={1}
              max={480}
              unit="min"
            />
            <NumberField
              label="Break"
              value={breakDraft}
              onChange={(next) => {
                setBreakDraft(next);
                if (next != null) void update({ defaultBreakMinutes: next });
              }}
              min={0}
              max={60}
              unit="min"
            />
          </View>
          <SettingRow
            label="Auto-start breaks"
            description="Start the break automatically when a focus phase ends"
            value={settings.autoStartBreaks}
            onValueChange={(next) => void update({ autoStartBreaks: next })}
          />
          <SettingRow
            label="Auto-start next focus"
            description="Start the next focus phase automatically when a break ends"
            value={settings.autoStartNextFocus}
            onValueChange={(next) => void update({ autoStartNextFocus: next })}
          />
        </Section>

        <Section title="Notifications">
          <SettingRow
            label="Phase completion alerts"
            description="Notify when a focus or break phase ends — permission is asked only when needed"
            value={settings.notificationsEnabled}
            onValueChange={(next) => {
              void update({ notificationsEnabled: next }).then(resyncCurrentNotification);
            }}
          />
        </Section>

        <Section title="Haptics">
          <SettingRow
            label="Haptic feedback"
            description="Subtle vibration on taps, selections, and completions"
            value={settings.hapticsEnabled}
            onValueChange={(next) => void update({ hapticsEnabled: next })}
          />
        </Section>

        <Section title="Sound">
          <SettingRow
            label="Pause with timer"
            description="Ambient sound pauses and resumes along with the timer"
            value={settings.pauseSoundWithTimer}
            onValueChange={(next) => void update({ pauseSoundWithTimer: next })}
          />
        </Section>

        <Section title="Statistics">
          <Text variant="body" color={theme.neutral.textMuted} style={{ fontSize: theme.fontSize.sm }}>
            Week starts on
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {WEEK_START_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={settings.weekStartsOn === option.value}
                onPress={() => {
                  haptics.select();
                  void update({ weekStartsOn: option.value });
                }}
              />
            ))}
          </View>
        </Section>
      </ScrollView>
    </Screen>
  );
}
