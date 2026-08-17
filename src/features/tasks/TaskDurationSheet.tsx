import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { IconButton } from '@/components/IconButton';
import { Text } from '@/components/Text';
import { MODE_DEFAULTS, type TimerMode } from '@/domain/timer/types';
import { MODE_LABELS } from '@/features/focus/ModePicker';
import { NumberField } from '@/features/rituals/NumberField';
import { useTheme } from '@/theme/ThemeProvider';

const MODES = Object.keys(MODE_LABELS) as TimerMode[];

export interface TaskDurationSheetProps {
  visible: boolean;
  onClose: () => void;
  mode: TimerMode | null;
  focusMinutes: number | null;
  onSave: (mode: TimerMode | null, focusMinutes: number | null) => void;
}

/**
 * Small popover, not a full-screen editor — the whole point is that customizing a task's
 * duration should be one tap away from the list, not a navigation away from it. "Default"
 * (null/null) means the task keeps using whatever mode is currently selected on the Focus
 * screen, same as every task before this feature existed.
 */
export function TaskDurationSheet({ visible, onClose, mode, focusMinutes, onSave }: TaskDurationSheetProps) {
  const theme = useTheme();
  const [draftMode, setDraftMode] = useState<TimerMode | null>(mode);
  const [draftFocusMinutes, setDraftFocusMinutes] = useState<number | null>(focusMinutes ?? 25);

  // Re-seed the draft from this task's current values every time the sheet opens, so a
  // cancelled edit (dismissed without Save) never leaks into the next time it's opened.
  useEffect(() => {
    if (visible) {
      setDraftMode(mode);
      setDraftFocusMinutes(focusMinutes ?? (mode ? (MODE_DEFAULTS[mode].focusMinutes ?? 25) : 25));
    }
  }, [visible, mode, focusMinutes]);

  const handleSelectMode = (nextMode: TimerMode | null) => {
    setDraftMode(nextMode);
    if (nextMode) setDraftFocusMinutes(MODE_DEFAULTS[nextMode].focusMinutes ?? 25);
  };

  const handleSave = () => {
    onSave(draftMode, draftMode ? draftFocusMinutes : null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close duration editor"
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: theme.neutral.background,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
            gap: theme.spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="title">Task Duration</Text>
            <IconButton
              icon="x"
              size={18}
              onPress={onClose}
              color={theme.neutral.text}
              backgroundColor={theme.neutral.surface}
              accessibilityLabel="Close duration editor"
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.xs }}>
            <Chip label="Default" selected={draftMode === null} onPress={() => handleSelectMode(null)} />
            {MODES.map((m) => (
              <Chip key={m} label={MODE_LABELS[m]} selected={draftMode === m} onPress={() => handleSelectMode(m)} />
            ))}
          </ScrollView>

          {draftMode && MODE_DEFAULTS[draftMode].focusMinutes !== null && (
            <NumberField
              label="Focus"
              value={draftFocusMinutes}
              onChange={setDraftFocusMinutes}
              min={1}
              max={480}
              unit="min"
            />
          )}

          {draftMode === null && (
            <Text variant="body" color={theme.neutral.textMuted}>
              Starting this task will use whatever mode is currently selected on the Focus screen.
            </Text>
          )}

          <Button label="Save" onPress={handleSave} />
        </View>
      </View>
    </Modal>
  );
}
