import { useLocalSearchParams } from 'expo-router';

import { RitualEditorScreen } from '@/features/rituals/RitualEditorScreen';

export default function EditRitualRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RitualEditorScreen ritualId={id} />;
}
