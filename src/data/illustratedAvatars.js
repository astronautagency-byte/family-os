// Optional, locally hosted choices. Never infer a user's identity or replace their photo.
export const ILLUSTRATED_AVATARS = [
  ['adult-auburn', 'Auburn hair', 'Adults'],
  ['adult-beard', 'Short hair and beard', 'Adults'],
  ['adult-east-asian', 'Black bob', 'Adults'],
  ['adult-hijab', 'Peach hijab', 'Adults'],
  ['adult-turban', 'Green turban', 'Adults'],
  ['teen-short-hair', 'Short-haired teen', 'Kids & teens'],
  ['child-curly-hair', 'Curly-haired child', 'Kids & teens'],
  ['child-straight-hair', 'Straight-haired child', 'Kids & teens'],
  ['older-woman', 'Silver bob and glasses', 'Older adults'],
  ['older-man', 'Silver hair and beard', 'Older adults'],
].map(([id, label, group]) => ({ id, label, group, url: `/avatars/flat-v1/${id}.png` }));
