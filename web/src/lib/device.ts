/** "wearable-01" → "Wearable 01"; other ids are shown with dashes as spaces, first letter capitalized. */
export function formatDeviceId(deviceId: string): string {
  const words = deviceId.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
