-- One durable announcement; do not reset any member's existing read state.
insert into public.product_updates (id, title, summary, body, category, icon, link_url, link_label, is_active, published_at)
values (
  'bb76980f-c1a6-47e8-b53e-d59a58d24021',
  'A little closer, wherever you are',
  'Meet Family location! Share while the location page is open, or send an “I’m okay” check-in.',
  'Location sharing is optional and stops when you leave the page or background the app. Check-ins do not send alerts.',
  'feature', 'location', '/location', 'Explore family location', true, now()
)
on conflict (id) do nothing;
