export const CHILD_TABS = ['calendar', 'tasks', 'rewards', 'chat'];
export const isChildAccount = (household, profile) => household?.role !== 'owner' && profile?.profileType === 'child';
export const allowedTab = (tab, childMode) => childMode && !CHILD_TABS.includes(tab) ? 'tasks' : tab;
