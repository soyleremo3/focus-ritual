import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Surface } from '@/components/Surface';
import { Text } from '@/components/Text';
import type { Task } from '@/domain/task/types';
import * as haptics from '@/lib/haptics';
import { useTaskStore } from '@/store/taskStore';
import { useTheme } from '@/theme/ThemeProvider';

export interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const theme = useTheme();
  const toggleDone = useTaskStore((s) => s.toggleDone);
  const updateTitle = useTaskStore((s) => s.updateTitle);
  const remove = useTaskStore((s) => s.remove);

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);

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

  return (
    <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <IconButton
        icon={task.isDone ? 'check-circle' : 'circle'}
        size={16}
        onPress={handleToggle}
        color={task.isDone ? theme.neutral.accent : theme.neutral.textMuted}
        backgroundColor="transparent"
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
          <Pressable onPress={() => !task.isDone && setEditing(true)} disabled={task.isDone}>
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

      {!task.isDone && <Button label="Start" onPress={handleStart} />}
      <IconButton
        icon="trash-2"
        size={16}
        onPress={handleDelete}
        color={theme.neutral.textMuted}
        backgroundColor="transparent"
      />
    </Surface>
  );
}
