import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, RefreshCw, ShieldCheck } from '../components/icons';
import { Avatar, Card, PrimaryButton, SecondaryButton } from '../components/ui';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import './FamilyLocation.css';

export default function FamilyLocation() {
  const { user, household } = useAuth();
  const { memberById = {} } = useFamily();
  const [locations, setLocations] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const watch = useRef(null);
  const positionTimer = useRef(null);
  const active = useRef(false);
  const mounted = useRef(true);
  const pending = useRef(Promise.resolve());
  const lastSent = useRef(0);

  const refresh = useCallback(async () => {
    if (!household?.id || !supabase) return;
    try {
      const [{ data, error: loadError }, { data: checkinData, error: checkinError }] = await Promise.all([
        supabase.rpc('get_family_locations', { h: household.id }),
        supabase.rpc('get_family_checkins', { h: household.id }),
      ]);
      if (loadError || checkinError) throw loadError || checkinError;
      if (mounted.current) { setLocations(data || []); setCheckins(checkinData || []); setError(''); }
    } catch { if (mounted.current) setError('Family updates could not be loaded. Try again.'); }
  }, [household?.id]);

  const stop = useCallback(async () => {
    active.current = false;
    if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
    if (positionTimer.current !== null) clearInterval(positionTimer.current);
    positionTimer.current = null;
    if (mounted.current) { setSharing(false); setBusy(true); }
    await pending.current;
    try {
      if (household?.id && supabase) {
        const { error: stopError } = await supabase.rpc('stop_family_location', { h: household.id });
        if (stopError) throw stopError;
        if (mounted.current) await refresh();
      }
    } catch {
      if (mounted.current) setError('Could not remove your location. It will stop being visible after 30 minutes. Try again.');
    } finally { if (mounted.current) setBusy(false); }
  }, [household?.id, refresh]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = setInterval(refresh, 30000);
    const onVisibility = () => { if (document.visibilityState === 'hidden' && active.current) void stop(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { mounted.current = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); if (active.current) void stop(); };
  }, [refresh, stop]);

  const start = () => {
    if (!navigator.geolocation || !window.isSecureContext) { setError('Location requires a supported browser and a secure connection.'); return; }
    setError(''); setBusy(true); active.current = true; lastSent.current = 0;
    const onPosition = position => {
      if (!active.current || Date.now() - lastSent.current < 30000) return;
      lastSent.current = Date.now();
      const { latitude, longitude, accuracy } = position.coords;
      pending.current = pending.current.then(async () => {
        if (!active.current) return;
        const { error: saveError } = await supabase.rpc('share_family_location', { h: household.id, lat: latitude, lon: longitude, accuracy });
        if (saveError) throw saveError;
        if (mounted.current && active.current) { setSharing(true); setBusy(false); await refresh(); }
      }).catch(() => {
        if (mounted.current) { setSharing(false); setError('Your location could not be shared. Please try again.'); setBusy(false); }
        active.current = false;
        if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
        watch.current = null;
        if (positionTimer.current !== null) clearInterval(positionTimer.current);
        positionTimer.current = null;
      });
    };
    const onPositionError = positionError => {
      active.current = false;
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
      if (positionTimer.current !== null) clearInterval(positionTimer.current);
      positionTimer.current = null;
      if (mounted.current) { setSharing(false); setBusy(false); setError(positionError.code === 1 ? 'Location permission was denied. You can allow it in your device settings.' : 'Your location is unavailable. Please try again.'); }
    };
    const options = { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 };
    watch.current = navigator.geolocation.watchPosition(onPosition, onPositionError, options);
    positionTimer.current = setInterval(() => {
      if (active.current) navigator.geolocation.getCurrentPosition(onPosition, onPositionError, options);
    }, 5 * 60 * 1000);
  };

  const checkIn = async () => {
    setBusy(true); setError('');
    try {
      const { error: checkinError } = await supabase.rpc('send_family_checkin', { h: household.id });
      if (checkinError) throw checkinError;
      await refresh();
    } catch { setError('Your check-in could not be saved. Please try again.'); }
    finally { setBusy(false); }
  };

  return <div className="family-location-page pb-28">
    <PageHeader title="Family location" subtitle="Share your location when it helps your family." />
    <main className="family-location-content">
      <Card className="family-location-intro"><span className="family-location-icon"><ShieldCheck size={22}/></span><div><h2>Share on your terms</h2><p>Only household members can see a location. Sharing is optional and updates while this page is open. It stops when you leave or put the app in the background; a last location may remain visible for up to 30 minutes if the app closes unexpectedly.</p><p>FamOS keeps only your latest location. This is not an emergency service.</p></div></Card>
      {!household?.id || !user?.id || !supabase ? <p>Sign in to a household to use family location.</p> : <>
        <div className="family-location-actions">
          {sharing || active.current ? <SecondaryButton disabled={busy} onClick={stop}>Stop sharing</SecondaryButton> : <PrimaryButton disabled={busy} onClick={start}><Navigation size={17}/> {busy ? 'Getting your location…' : 'Share my location'}</PrimaryButton>}
          {!sharing && !active.current && locations.some(location => location.user_id === user.id) && <SecondaryButton disabled={busy} onClick={stop}>Remove my last location</SecondaryButton>}
          <button type="button" className="family-location-refresh" onClick={refresh}><RefreshCw size={16}/> Refresh</button>
        </div>
        <p className="family-location-status" role="status">{sharing ? 'Sharing while this page is open.' : 'Your location is not being updated.'}</p>
        {error && <p className="family-location-error" role="alert">{error}</p>}
        <section className="family-location-checkins" aria-labelledby="family-checkins-heading"><div><h2 id="family-checkins-heading">Check-ins</h2><p>Let your household know you’re okay. A check-in does not share your location or send an alert.</p></div><SecondaryButton disabled={busy} onClick={checkIn}>I’m okay</SecondaryButton>
          {checkins.length > 0 && <ul>{checkins.map(item => <li key={item.user_id}><strong>{memberById[item.user_id]?.name || 'Family member'}{item.user_id === user.id ? ' · You' : ''}</strong><span>Checked in {new Date(item.checked_at).toLocaleString()}</span></li>)}</ul>}
          <small>Check-ins are shown for 24 hours.</small>
        </section>
        <section className="family-location-list" aria-labelledby="family-location-heading"><h2 id="family-location-heading">Family locations</h2>
          {locations.length ? locations.map(location => <article className="family-location-member" key={location.user_id}><Avatar member={memberById[location.user_id] || { name: 'Family member' }}/><div><strong>{memberById[location.user_id]?.name || 'Family member'}{location.user_id === user.id ? ' · You' : ''}</strong><small>Updated {new Date(location.updated_at).toLocaleString()} · Approx. {Math.round(location.accuracy_m)} m accuracy</small></div><a href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${memberById[location.user_id]?.name || 'family member'} location in Google Maps`}><MapPin size={16}/> Open map</a></article>) : <p>No one is sharing a location right now.</p>}
          <small>Opening a map sends that location to Google Maps.</small>
        </section>
      </>}
    </main>
  </div>;
}
