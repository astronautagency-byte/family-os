-- Editable calendar colors: the FamOS calendar and Google calendars can be
-- recolored from the calendar manager. Colors are hex strings (#RRGGBB) and
-- are stored per calendar preference row (provider 'famos' for the built-in
-- household calendar, 'google' for connected Google calendars).

alter table public.calendar_sharing_preferences
  add column if not exists calendar_color text;
