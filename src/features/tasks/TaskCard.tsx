import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Surface } from '@/components/Surface';
import { Text } from '@/components/Text';
import { formatFocusDuration } from '@/domain/stats/statsAggregation';
import type { Task } from '@/domain/task/types';
import * as haptics from '@/lib/haptics';
import { useTaskStore } from '@/store/taskStore';
import { useTheme } from '@/theme/ThemeProvider';

import { TaskDurationSheet } from './TaskDurationSheet';

export interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const theme = useTheme();
  const toggleDone = useTaskStore((s) => s.toggleDone);
  const updateTitle = useTaskStore((s) => s.updateTitle);
  const updateDuration = useTaskStore((s) => s.updateDuration);
  const remove = useTaskStore((s) => s.remove);

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [durationSheetVisible, setDurationSheetVisible] = useState(false);

  const handleToggle = () => {
    haptics.select();
    void toggleDone(task.id);
  };

  const handleStart = () => {
    haptics.tap();
    router.push({ pathname: '/', params: { startTaskId: task.id } });
  };

  const handleEditSubmit = () => {
    setEditing(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== task.title) {
      void updateTitle(task.id, trimmed);
    } else {
      setDraftTitle(task.title);
    }
  };

  const handleDelete = () => {
    haptics.tap();
    Alert.alert('Delete Task', `Delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove(task.id) },
    ]);
  };

  const handleOpenDuration = () => {
    haptics.tap();
    setDurationSheetVisible(true);
  };

  const durationLabel = task.mode && task.focusMinutes ? formatFocusDuration(task.focusMinutes * 60_000) : 'Default';

  return (
    <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <IconButton
        icon={task.isDone ? 'check-circle' : 'circle'}
        size={16}
        onPress={handleToggle}
        color={task.isDone ? theme.neutral.accent : theme.neutral.textMuted}
        backgroundColor="transparent"
        accessibilityLabel={task.isDone ? 'Mark task not done' : 'Mark task done'}
        accessibilityState={{ checked: task.isDone }}
      />

      <View style={{ flex: 1 }}>
        {editing ? (
          <TextInput
            value={draftTitle}
            onChangeText={setDraftTitle}
            onSubmitEditing={handleEditSubmit}
            onBlur={handleEditSubmit}
            autoFocus
            maxLength={140}
            style={{
              fontFamily: theme.fontFamily.sansRegular,
              fontSize: theme.fontSize.md,
              color: theme.neutral.text,
              paddingVertical: theme.spacing.xxs,
            }}
          />
        ) : (
          <Pressable
            onPress={() => !task.isDone && setEditing(true)}
            disabled={task.isDone}
            accessibilityRole={task.isDone ? undefined : 'button'}
            accessibilityLabel={task.isDone ? undefined : `Edit task: ${task.title}`}
          >
            <Text
              variant="body"
              color={task.isDone ? theme.neutral.textMuted : theme.neutral.text}
              style={task.isDone ? { textDecorationLine: 'line-through' } : undefined}
            >
              {task.title}
            </Text>
          </Pressable>
        )}
      </View>

      {!task.isDone && (
        <Pressable
          onPress={handleOpenDuration}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Change duration, currently ${durationLabel}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xxs,
            paddingVertical: theme.spacing.xxs,
            paddingHorizontal: theme.spacing.xs,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.neutral.background,
          }}
        >
          <Feather name="clock" size={12} color={theme.neutral.textMuted} />
          <Text variant="caption" color={theme.neutral.textMuted}>
            {durationLabel}
          </Text>
        </Pressable>
      )}
      {!task.isDone && <Button label="Start" onPress={handleStart} />}
      <IconButton
        icon="trash-2"
        size={16}
        onPress={handleDelete}
        color={theme.neutral.textMuted}
        backgroundColor="transparent"
        accessibilityLabel="Delete task"
      />

      <TaskDurationSheet
        visible={durationSheetVisible}
        onClose={() => setDurationSheetVisible(false)}
        mode={task.mode}
        focusMinutes={task.focusMinutes}
        onSave={(mode, focusMinutes) => void updateDuration(task.id, mode, focusMinutes)}
      />
    </Surface>
  );
}
