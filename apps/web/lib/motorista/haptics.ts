export function vibrateShort() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(40);
  }
}

export function vibrateAlertPattern() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([60, 40, 60]);
  }
}
