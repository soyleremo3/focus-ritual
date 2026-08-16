import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

export default function SettingsScreen() {
  return (
    <Screen>
      <EmptyState icon="settings" title="Settings" message="App settings are coming in a future phase." />
    </Screen>
  );
}
