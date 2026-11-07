-- The project has pg_cron installed. Keep expired location data and
-- check-ins out of long-term storage, even when nobody opens the app.
select cron.schedule(
  'famos-family-location-retention',
  '*/10 * * * *',
  $job$
    delete from public.family_locations where expires_at <= now();
    delete from public.family_checkins where checked_at <= now() - interval '24 hours';
  $job$
);
