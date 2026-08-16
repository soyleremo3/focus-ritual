import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '@/store/settingsStore';

function enabled(): boolean {
  return useSettingsStore.getState().settings.hapticsEnabled;
}

/** Light tap — primary button presses (play, pause, skip). */
export function tap() {
  if (!enabled()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Selection change — mode picker, chip toggles. */
export function select() {
  if (!enabled()) return;
  void Haptics.selectionAsync();
}

/** A phase or session completed. */
export function success() {
  if (!enabled()) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
