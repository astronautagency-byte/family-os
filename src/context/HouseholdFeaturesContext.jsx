import {createContext,useContext,useEffect,useState,useCallback} from 'react';
import {useAuth} from './AuthContext';
import {supabase} from '../lib/supabase';
import {DEFAULT_FEATURES,normalizeFeatures} from '../lib/householdFeatures';

const fallback={features:DEFAULT_FEATURES,pauseReminders:false,loading:false,error:'',canManage:false};
const Context=createContext(fallback);
export const useHouseholdFeatures=()=>useContext(Context);
export function HouseholdFeaturesProvider({children}) {
 const {household,user}=useAuth();
 const [state,setState]=useState({...fallback,householdId:null});
 const canManage=household?.role==='owner';
 const refresh=useCallback(async()=>{
  if(!household?.id || !supabase) return;
  const {data,error}=await supabase.from('household_feature_preferences').select('features,pause_reminders').eq('household_id',household.id).maybeSingle();
  setState({householdId:household.id,features:normalizeFeatures(data?.features),pauseReminders:data?.pause_reminders===true,loading:false,error:error?'Customization could not load. Existing pages remain available. Retry before saving.':''});
 },[household?.id]);
 useEffect(()=>{
  let active=true;
  setState({...fallback,householdId:household?.id,loading:!!household?.id});
  if(!household?.id || !supabase)return;
  const load=async()=>{
   const {data,error}=await supabase.from('household_feature_preferences').select('features,pause_reminders').eq('household_id',household.id).maybeSingle();
   if(active)setState({householdId:household.id,features:normalizeFeatures(data?.features),pauseReminders:data?.pause_reminders===true,loading:false,error:error?'Customization could not load. Existing pages remain available. Retry before saving.':''});
  };
  load();
  const channel=supabase.channel('household-features-'+household.id).on('postgres_changes',{event:'*',schema:'public',table:'household_feature_preferences',filter:'household_id=eq.'+household.id},load).subscribe();
  const focus=()=>load();window.addEventListener('focus',focus);
  return()=>{active=false;supabase.removeChannel(channel);window.removeEventListener('focus',focus);};
 },[household?.id,user?.id]);
 const save=async(features,pauseReminders)=>{
  if(!canManage)throw Error('Only the household owner can customize FamOS.');
  if(state.loading || state.error)throw Error('Load the current settings before saving.');
  const {error}=await supabase.rpc('set_household_features',{h:household.id,selection:normalizeFeatures(features),pause:pauseReminders});
  if(error)throw Error(error.message || 'Could not save household settings.');
  setState({...state,features:normalizeFeatures(features),pauseReminders});
 };
 const current=state.householdId===household?.id?state:{...fallback,loading:!!household?.id};
 return <Context.Provider value={{...current,canManage,save,refresh}}>{children}</Context.Provider>;
}
