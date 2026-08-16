import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

export default function RitualsScreen() {
  return (
    <Screen>
      <EmptyState
        icon="repeat"
        title="Rituals"
        message="Reusable Focus Ritual presets — timer mode, space, and sound mix saved together — are coming in a future phase."
      />
    </Screen>
  );
}
