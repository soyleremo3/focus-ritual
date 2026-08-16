import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

export default function TasksScreen() {
  return (
    <Screen>
      <EmptyState icon="check-square" title="Today" message="A minimal Today task list is coming in a future phase." />
    </Screen>
  );
}
