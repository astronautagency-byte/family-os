import { ILLUSTRATED_AVATARS } from '../data/illustratedAvatars';
import { useState } from 'react';
import { Avatar } from './ui';
import './illustrated-avatar-picker.css';

export default function IllustratedAvatarPicker({ value, onChange }) {
  const [filter,setFilter]=useState('All');
  return <fieldset className="illustrated-avatar-picker">
    <legend>Or choose an illustration</legend>
    <p>Choose any style you like—these choices are for everyone. Save your profile to apply it.</p>
    <div className="illustrated-avatar-filters" role="group" aria-label="Browse avatar ages">{['All','Kids & teens','Adults','Older adults'].map(group=><button type="button" key={group} aria-pressed={filter===group} onClick={()=>setFilter(group)}>{group}</button>)}</div>
    {['Adults', 'Kids & teens', 'Older adults'].filter(group=>filter==='All'||group===filter).map(group => <div key={group} className="illustrated-avatar-group">
      <h3>{group}</h3>
      <div className="illustrated-avatar-options">{ILLUSTRATED_AVATARS.filter(avatar => avatar.group === group).map(avatar => <button
        type="button" key={avatar.id} aria-label={`Choose ${avatar.label}`} aria-pressed={value === avatar.url}
        onClick={() => onChange(avatar.url)}>
        <Avatar member={{name:avatar.label,avatarUrl:avatar.url}} size="xl"/>
        <span>{avatar.label}</span>
      </button>)}</div>
    </div>)}
  </fieldset>;
}
