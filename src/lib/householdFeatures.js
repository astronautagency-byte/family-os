export const PAGE_OPTIONS = [
 ['calendar','Calendar'],['tasks','Tasks'],['groceries','Shopping'],['kitchen','Kitchen'],
 ['meals','Meal Planning'],['recipes','Recipe Book'],['rewards','RewardBank'],['chat','Chat'],
];
export const FEATURE_OPTIONS = [
 ['fam_ai','FamAI'],['insights','Insights'],['celebrations','Celebrations'],['routine_suggestions','Routine suggestions'],
 ['family_packs','Family Packs'],
];
export const DEFAULT_FEATURES = Object.fromEntries([...PAGE_OPTIONS,...FEATURE_OPTIONS].map(([key])=>[key,true]));
export const normalizeFeatures = value => Object.fromEntries(Object.keys(DEFAULT_FEATURES).map(key=>[key,value?.[key]!==false]));
export function presetFeatures(name) {
 const enabled = name==='simple' ? ['calendar','tasks','chat'] : ['calendar','tasks','chat','groceries','meals','recipes','celebrations'];
 return Object.fromEntries(Object.keys(DEFAULT_FEATURES).map(key=>[key,enabled.includes(key)]));
}
export function resolveFeatures(saved={}, runtime={}) {
 return Object.fromEntries(Object.keys(DEFAULT_FEATURES).map(key=>[key,saved[key]!==false && runtime[key]!==false]));
}
export function featureRoute(tab, child, features=DEFAULT_FEATURES) {
 const permitted = child ? ['calendar','tasks','rewards','chat'] : ['today',...PAGE_OPTIONS.map(([key])=>key),'settings','famai'];
 if(permitted.includes(tab) && features[tab==='famai'?'fam_ai':tab]!==false) return tab;
 return child ? permitted.find(key=>features[key]!==false) || 'child-empty' : 'today';
}
