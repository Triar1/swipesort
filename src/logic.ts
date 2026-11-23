import { type Category, type Decision } from './model';

export function upsertDecision(all: Decision[], next: Decision): Decision[] {
  return [...all.filter(d => d.id !== next.id), next];
}
export function removeDecision(all: Decision[], id: string): Decision[] {
  return all.filter(d => d.id !== id);
}
export function countDecisions(all: Decision[]) {
  return {
    kept: all.filter(d => d.action === 'keep').length,
    pending: all.filter(d => d.action === 'trash').length,
    deleted: all.filter(d => d.action === 'deleted').length,
    reviewed: all.length,
  };
}
/** Default: choose only uncurated camera folders; NEVER auto-select organized albums. */
export function suggestSourceIds(albums: { id: string; title: string }[]): string[] {
  return albums.filter(album => /^(camera|caméra|appareil photo|dcim\/camera)$/i.test(album.title.trim()) &&
    !album.title.startsWith('SwipeSort - ')).map(a => a.id);
}
export function isAppAlbum(name: string) { return name.toLowerCase().startsWith('swipesort - '); }
export function visiblePhotos<T extends { id: string }>(photos: T[], decisions: Decision[]): T[] {
  const seen = new Set(decisions.map(d => d.id));
  return photos.filter(p => !seen.has(p.id));
}
export function shufflePhotos<T>(items: T[], random: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
export function canDeleteCategory(category: Category, categories: Category[], decisions: Decision[]) {
  return categories.length > 1 && !decisions.some(d => d.category === category.id && d.action === 'keep');
}
export function reclassifyDecision(all: Decision[], id: string, categoryId: string) {
  return all.map(d => d.id === id && d.action === 'keep'
    ? { ...d, category: categoryId, synced: d.category === categoryId ? d.synced : false, timestamp: Date.now() }
    : d);
}
