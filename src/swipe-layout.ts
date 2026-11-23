/**
 * Fits a photo *fully* inside the available viewport, while anchoring it at y=0.
 * React Native's resizeMode="contain" in a full-height frame vertically centers
 * landscape photos, leaving a huge blank area above; this solves that issue.
 */
export function fitPhotoAtTop(
  availableWidth: number, availableHeight: number,
  photoWidth?: number, photoHeight?: number,
): { width: number; height: number } {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0 ||
      !Number.isFinite(availableHeight) || availableHeight <= 0) {
    return { width: 0, height: 0 };
  }
  const width = Number(photoWidth);
  const height = Number(photoHeight);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return { width: availableWidth, height: availableHeight };
  }
  const ratio = Math.min(availableWidth / width, availableHeight / height);
  return { width: width * ratio, height: height * ratio };
}

/** Expo legacy MediaLibrary creationTime is normally in milliseconds.
 * The guard also accepts seconds from older records without producing years like 58772.
 */
export function formatPhotoMonth(creationTime?: number): string {
  if (typeof creationTime !== 'number' || !Number.isFinite(creationTime) || creationTime <= 0) return '';
  const millis = creationTime < 100_000_000_000 ? creationTime * 1000 : creationTime;
  const date = new Date(millis);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 1900 || date.getFullYear() > 2100) return '';
  return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}
