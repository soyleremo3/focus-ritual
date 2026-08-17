import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
  const refresh = useTaskStore((s) => s.refresh);
  const create = useTaskStore((s) => s.create);

  const [draftTitle, setDraftTitle] = useState('');

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
          onPress={handleAdd}
          disabled={!isValidTaskTitle(draftTitle)}
          accessibilityLabel="Add task"
        />
      </View>

      {loaded && tasks.length === 0 ? (
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
