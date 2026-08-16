import * as Haptics from 'expo-haptics';

/** Light tap — primary button presses (play, pause, skip). */
export function tap() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Selection change — mode picker, chip toggles. */
export function select() {
  void Haptics.selectionAsync();
}

/** A phase or session completed. */
export function success() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
