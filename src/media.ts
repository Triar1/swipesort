import * as MediaLibrary from 'expo-media-library/legacy';
import { type Category, type Decision } from './model';

export type Photo = MediaLibrary.Asset;
export type PhoneAlbum = MediaLibrary.Album;
export async function requestLibraryAccess() {
  return MediaLibrary.requestPermissionsAsync(false, ['photo']);
}
export async function getLibraryAccess() {
  return MediaLibrary.getPermissionsAsync(false, ['photo']);
}
export async function listPhoneAlbums(): Promise<PhoneAlbum[]> {
  return MediaLibrary.getAlbumsAsync();
}

/** Fetch an album page, never scan a different (potentially organized) album. */
export async function getPhotoPage(albumId: string, after?: string) {
  return MediaLibrary.getAssetsAsync({
    album: albumId,
    first: 150,
    ...(after ? { after } : {}),
    mediaType: MediaLibrary.MediaType.photo,
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
  });
}
export async function deleteFromDevice(photoIds: string[]): Promise<boolean> {
  if (!photoIds.length) return true;
  return MediaLibrary.deleteAssetsAsync(photoIds);
}

/**
 * One Android permission prompt PER BATCH rather than per individual asset,
 * subject to the Android OS / device's mandatory permission behavior.
 * Only unsynced photos are touched. Moves, does not intentionally duplicate.
 */
export async function syncToPhoneAlbums(
  decisions: Decision[],
  categories: Category[],
  onSuccess: (ids: string[]) => void,
  onProgress: (text: string) => void,
): Promise<{ processed: number; errors: string[]; canceled: boolean }> {
  let processed = 0;
  let canceled = false;
  const errors: string[] = [];
  for (const category of categories) {
    if (canceled) break;
    const pending = decisions.filter(d => d.action === 'keep' && d.category === category.id && !d.synced);
    if (!pending.length) continue;
    const title = category.albumTitle || `SwipeSort - ${category.label}`;
    onProgress(`${category.emoji} ${category.label} · ${pending.length} photo(s)`);
    let album: MediaLibrary.Album | null = null;
    try { album = await MediaLibrary.getAlbumAsync(title); }
    catch (error) { errors.push(`${title} : ${String(error)}`); continue; }
    let start = 0;
    if (!album) {
      try {
        // Android cannot create an empty gallery album. First file is moved into it.
        album = await MediaLibrary.createAlbumAsync(title, pending[0].id, false);
        onSuccess([pending[0].id]);
        processed++;
        start = 1;
      } catch (error) {
        errors.push(`${title} : ${String(error)}`);
        if (/permission|refus|denied|cancel/i.test(String(error))) canceled = true;
        continue;
      }
    }
    if (!album) continue;
    // Expo Android requests permission for the entire array at once.
    // Limit per-dialog size; can still be one approval for every 120 photos.
    const batchSize = 120;
    for (let i = start; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);
      try {
        const ok = await MediaLibrary.addAssetsToAlbumAsync(batch.map(d => d.id), album.id, false);
        if (!ok) { errors.push(`${title} : lot de ${batch.length} photo(s) refusé`); canceled = true; break; }
        onSuccess(batch.map(d => d.id));
        processed += batch.length;
      } catch (error) {
        errors.push(`${title} : ${String(error)}`);
        if (/permission|refus|denied|cancel/i.test(String(error))) canceled = true;
        break;
      }
    }
  }
  return { processed, errors, canceled };
}
