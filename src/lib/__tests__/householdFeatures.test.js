import {it,expect} from 'vitest';
import {DEFAULT_FEATURES,normalizeFeatures,presetFeatures,resolveFeatures,featureRoute} from '../householdFeatures';
import {notificationFeature,reminderPaused} from '../../../supabase/functions/_shared/feature-reminders';
it('defaults existing households to all features and ignores unknown keys',()=>{
 expect(normalizeFeatures()).toEqual(DEFAULT_FEATURES);
 expect(normalizeFeatures({tasks:false,unknown:false})).toEqual({...DEFAULT_FEATURES,tasks:false});
});
it('presets are explicit and preserve independent Recipe Book selection',()=>{
 expect(presetFeatures('simple').tasks).toBe(true);
 expect(presetFeatures('simple').meals).toBe(false);
 expect(featureRoute('recipes',false,{...DEFAULT_FEATURES,meals:false})).toBe('recipes');
});
it('cannot override service-disabled pages and always retains adult settings',()=>{
 expect(resolveFeatures({tasks:true},{tasks:false}).tasks).toBe(false);
 expect(featureRoute('settings',false,{...DEFAULT_FEATURES,tasks:false})).toBe('settings');
 expect(featureRoute('tasks',false,{...DEFAULT_FEATURES,tasks:false})).toBe('today');
});
it('child fallback respects disabled pages including all-off state',()=>{
 expect(featureRoute('settings',true,{...DEFAULT_FEATURES,calendar:false})).toBe('tasks');
 expect(featureRoute('settings',true,{calendar:false,tasks:false,rewards:false,chat:false})).toBe('child-empty');
});
it('pauses only when explicitly requested, including legacy hash links',()=>{
 const notice={url:'/#tasks'};
 expect(notificationFeature(notice)).toBe('tasks');
 expect(reminderPaused({pause_reminders:false,features:{tasks:false}},notice)).toBe(false);
 expect(reminderPaused({pause_reminders:true,features:{tasks:false}},notice)).toBe(true);
 expect(reminderPaused({pause_reminders:true,features:{tasks:true}},notice)).toBe(false);
 expect(reminderPaused({pause_reminders:true,features:{tasks:false}},{tag:'test-notification'})).toBe(false);
});
