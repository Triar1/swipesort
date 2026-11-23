export type CategoryId = string;
export type Category = {
  id: CategoryId;
  label: string;
  emoji: string;
  color: string;
  /** Album name is kept stable after renaming the in-app category. */
  albumTitle?: string;
};
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'famille', label: 'Famille', emoji: '🏡', color: '#F3B471', albumTitle: 'SwipeSort - Famille' },
  { id: 'couple', label: 'Couple', emoji: '💗', color: '#F79FB6', albumTitle: 'SwipeSort - Couple' },
  { id: 'amis', label: 'Amis', emoji: '🫶', color: '#B6A1FF', albumTitle: 'SwipeSort - Amis' },
  { id: 'cours', label: 'Cours', emoji: '📚', color: '#8BBEFC', albumTitle: 'SwipeSort - Cours' },
  { id: 'voyages', label: 'Voyages', emoji: '✈️', color: '#8EE3CA', albumTitle: 'SwipeSort - Voyages' },
  { id: 'autre', label: 'Autre', emoji: '✨', color: '#C6C6D8', albumTitle: 'SwipeSort - Autre' },
];
export const PALETTE = ['#F3B471','#F79FB6','#B6A1FF','#8BBEFC','#8EE3CA','#C6C6D8','#E9A7FF','#FCD97B'];
export type Decision = {
  id: string;
  uri: string;
  filename: string;
  category: CategoryId | null;
  action: 'keep' | 'trash' | 'deleted';
  synced: boolean;
  timestamp: number;
};
// Keep the original key: upgrading must not reset existing sorting history.
export const STORE_KEY = 'swipesort:decisions:v1';
export const CATEGORY_KEY = 'swipesort:categories:v2';
export const SOURCE_KEY = 'swipesort:sources:v2';
export const RANDOM_KEY = 'swipesort:random:v2';
export const THEME = {
  bg: '#100E18', surface: '#1B1828', surface2: '#282439', border: '#393449',
  white: '#F9F6FF', muted: '#AAA6BE', violet: '#AC97FF', pink: '#FDA6C2',
  green: '#83DAB7', red: '#FF667F',
};
