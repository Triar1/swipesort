export type TouchPoint = { pageX: number; pageY: number };
/** Physical distance between two touches, independent of photo dimensions. */
export function pinchDistance(touches: readonly TouchPoint[]): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.hypot(dx, dy);
}
/** Temporary pinch-only scale. Never persists and never changes the image file. */
export function pinchScale(currentDistance: number, initialDistance: number, maxZoom = 3): number {
  if (!Number.isFinite(initialDistance) || initialDistance <= 0 || !Number.isFinite(currentDistance)) return 1;
  return Math.max(1, Math.min(maxZoom, currentDistance / initialDistance));
}
