export const DEFAULT_SHORTCUTS = ['today', 'calendar', 'tasks', 'chat'];
export const CHILD_SHORTCUTS = ['calendar', 'tasks', 'rewards', 'chat'];
export const SHORTCUT_COUNT = 4;

export function resolveShortcuts(saved, available, defaults = DEFAULT_SHORTCUTS) {
  const candidates = [...(Array.isArray(saved) ? saved : []), ...defaults, ...available];
  return [...new Set(candidates.filter(id => typeof id === 'string' && available.includes(id)))].slice(0, SHORTCUT_COUNT);
}

export function readShortcuts(key) {
  try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
