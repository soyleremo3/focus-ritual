import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

export default function HistoryScreen() {
  return (
    <Screen>
      <EmptyState
        icon="bar-chart-2"
        title="History"
        message="Session history and local statistics are coming in a future phase."
      />
    </Screen>
  );
}
