import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { isValidTaskTitle } from '@/domain/task/task';
import * as haptics from '@/lib/haptics';
import { useTaskStore } from '@/store/taskStore';
import { useTheme } from '@/theme/ThemeProvider';

import { TaskCard } from './TaskCard';

export function TodayScreen() {
  const theme = useTheme();
  const tasks = useTaskStore((s) => s.tasks);
  const loaded = useTaskStore((s) => s.loaded);
  const error = useTaskStore((s) => s.error);
  const refresh = useTaskStore((s) => s.refresh);
  const create = useTaskStore((s) => s.create);

  const [draftTitle, setDraftTitle] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Refetch every time this tab regains focus, matching RitualsListScreen's pattern.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const handleAdd = () => {
    const trimmed = draftTitle.trim();
    if (!isValidTaskTitle(trimmed)) return;
    haptics.tap();
    setDraftTitle('');
    void create(trimmed);
  };

  // The add button must never feel dead on tap — `disabled` makes a Pressable swallow the
  // press entirely (no feedback at all), which reads as broken. When there's nothing valid
  // to add yet, tapping it just focuses the input instead of doing nothing.
  const handleAddPress = () => {
    if (isValidTaskTitle(draftTitle)) {
      handleAdd();
    } else {
      inputRef.current?.focus();
    }
  };

  return (
    <Screen>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.sm }}>
        <Text variant="title">Today</Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
        }}
      >
        <TextInput
          ref={inputRef}
          value={draftTitle}
          onChangeText={setDraftTitle}
          onSubmitEditing={handleAdd}
          placeholder="Add a task…"
          placeholderTextColor={theme.neutral.textMuted}
          returnKeyType="done"
          maxLength={140}
          style={{
            flex: 1,
            fontFamily: theme.fontFamily.sansRegular,
            fontSize: theme.fontSize.md,
            color: theme.neutral.text,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.pill,
            borderWidth: 1,
            borderColor: theme.neutral.border,
          }}
        />
        <IconButton
          icon="plus"
          onPress={handleAddPress}
          style={{ opacity: isValidTaskTitle(draftTitle) ? 1 : 0.5 }}
          accessibilityLabel="Add task"
        />
      </View>

      {error ? (
        <EmptyState icon="alert-triangle" title="Couldn't load tasks" message={error} onRetry={() => void refresh()} />
      ) : loaded && tasks.length === 0 ? (
        <EmptyState
          icon="check-square"
          title="Nothing today"
          message="Add a task, then start a focus session for it in one tap."
        />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TaskCard task={item} />}
          contentContainerStyle={{ padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.sm }}
        />
      )}
    </Screen>
  );
}
