import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { generateId } from '@/domain/id';

const SPACES_SUBDIR = 'spaces';

function extensionFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)(?:\?.*)?$/.exec(uri);
  return match?.[1]?.toLowerCase() ?? 'jpg';
}

/**
 * Launches the system photo picker and copies the chosen image into this app's own
 * persistent document storage (expo-file-system's File/Directory API) — the picker's own
 * asset URI is a transient cache path with no durability guarantee across app restarts,
 * so a custom Focus Space must never store it directly. Returns null if the user cancels.
 */
export async function pickAndCopySpaceImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.9,
  });
  if (result.canceled) return null;

  const picked = result.assets[0];
  if (!picked) return null;

  // The web picker already hands back a self-contained blob/data URI — there's no native
  // document-directory concept on web to copy into, so the picked URI is already
  // "persistent" enough for browser preview testing.
  if (Platform.OS === 'web') return picked.uri;

  const spacesDir = new Directory(Paths.document, SPACES_SUBDIR);
  if (!spacesDir.exists) spacesDir.create();

  const destination = new File(spacesDir, `${generateId()}.${extensionFromUri(picked.uri)}`);
  await new File(picked.uri).copy(destination);
  return destination.uri;
}
