import { useLocalSearchParams } from 'expo-router';

import { SpaceEditorScreen } from '@/features/spaces/SpaceEditorScreen';

export default function EditSpaceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SpaceEditorScreen spaceId={id} />;
}
