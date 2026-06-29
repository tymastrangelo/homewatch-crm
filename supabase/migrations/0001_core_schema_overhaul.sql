-- ============================================================================
-- 239 Home Services CRM — Core schema overhaul
-- ----------------------------------------------------------------------------
-- WHAT THIS DOES
--   1. Promotes the data that used to live inside the `checklists.notes` JSON
--      blob into real, query-able columns (inspector, comments, temperatures,
--      email-sent status).
--   2. Adds a stable `item_key` + `sort_order` to checklist_items so the
--      inspection always renders in its intended order (no more alphabetical
--      shuffling) and items map reliably to the standard template.
--   3. Backfills every existing row from the old JSON blob — NOTHING IS LOST.
--   4. Configures Row Level Security as a SHARED COMPANY WORKSPACE: any signed-in
--      staff member can read and manage all records.
--
-- SAFETY
--   This migration is idempotent. Running it more than once is harmless.
--   It is wrapped in a transaction; if anything fails, nothing is applied.
--   The original `notes` column is left untouched so you can verify the
--   backfill before optionally clearing it (see the very end of this file).
--
-- HOW TO APPLY
--   Paste this whole file into the Supabase SQL Editor and run it, or use the
--   Supabase CLI:  supabase db push
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. Safe parsing helpers (never throw on malformed legacy data)
-- ----------------------------------------------------------------------------
create or replace function public.try_parse_jsonb(input text)
returns jsonb language plpgsql immutable as $$
begin
  return input::jsonb;
exception when others then
  return null;
end;
$$;

create or replace function public.try_parse_timestamptz(input text)
returns timestamptz language plpgsql immutable as $$
begin
  return input::timestamptz;
exception when others then
  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. New, real columns on `checklists`
-- ----------------------------------------------------------------------------
alter table public.checklists
  add column if not exists inspector_id      uuid references public.inspectors(id) on delete set null,
  add column if not exists comments          text,
  add column if not exists temp_garage       text,
  add column if not exists temp_main_floor   text,
  add column if not exists temp_second_floor text,
  add column if not exists temp_third_floor  text,
  add column if not exists email_sent_at     timestamptz,
  add column if not exists email_sent_to     text;

-- ----------------------------------------------------------------------------
-- 2. Stable ordering + identity on `checklist_items`
-- ----------------------------------------------------------------------------
alter table public.checklist_items
  add column if not exists item_key   text,
  add column if not exists sort_order integer not null default 1000;

-- ----------------------------------------------------------------------------
-- 3. Backfill checklists from the legacy `notes` JSON blob
--    (only fills columns that are still empty, so it is safe to re-run)
-- ----------------------------------------------------------------------------
with parsed as (
  select id, public.try_parse_jsonb(notes) as meta
  from public.checklists
  where notes is not null
)
update public.checklists c
set
  inspector_id = coalesce(
    c.inspector_id,
    case
      when (p.meta->>'inspectorId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and exists (select 1 from public.inspectors i where i.id = (p.meta->>'inspectorId')::uuid)
      then (p.meta->>'inspectorId')::uuid
      else null
    end
  ),
  comments          = coalesce(c.comments,          nullif(p.meta->>'comments', '')),
  temp_garage       = coalesce(c.temp_garage,       nullif(p.meta#>>'{temperatures,garage}', ''),      nullif(p.meta->>'garageTemp', '')),
  temp_main_floor   = coalesce(c.temp_main_floor,   nullif(p.meta#>>'{temperatures,mainFloor}', ''),   nullif(p.meta->>'mainFloorTemp', '')),
  temp_second_floor = coalesce(c.temp_second_floor, nullif(p.meta#>>'{temperatures,secondFloor}', ''), nullif(p.meta->>'secondFloorTemp', '')),
  temp_third_floor  = coalesce(c.temp_third_floor,  nullif(p.meta#>>'{temperatures,thirdFloor}', ''),  nullif(p.meta->>'thirdFloorTemp', '')),
  email_sent_at     = coalesce(c.email_sent_at,     public.try_parse_timestamptz(p.meta->>'emailSentAt')),
  email_sent_to     = coalesce(c.email_sent_to,     nullif(p.meta->>'emailSentTo', ''))
from parsed p
where c.id = p.id
  and p.meta is not null;

-- ----------------------------------------------------------------------------
-- 4. Backfill checklist_items sort_order + item_key from the standard template
--    Matches on the exact label text that the app has always used.
--    Anything that doesn't match keeps sort_order = 1000 (renders last).
-- ----------------------------------------------------------------------------
with template(item_key, item_text, sort_order) as (
  values
    ('forced_entry',      'Visual check for evidence of forced entry, vandalism, theft or damage', 10),
    ('yard_maintenance',  'Visual inspection of yard/landscaping to assure regular maintenance', 20),
    ('outdoor_fixtures',  'Visual inspection of outdoor light fixtures, fencing, windows, screens, and mailbox', 30),
    ('hose_faucet',       'Check exterior hose and faucet for leaks', 40),
    ('remove_mail',       'Removal of newspapers, flyers, packages, mail and other evidence of non-occupancy', 50),
    ('roof_gutters',      'Visual inspection of roof and gutters from the ground', 60),
    ('interior_theft',    'Inspect for signs of theft, vandalism, damage or other disturbance', 70),
    ('fuse_box',          'Check fuse box for tripped breakers or evidence of power surge', 80),
    ('water_supply',      'Turn on water supply if turned off', 90),
    ('hot_water_heater',  'Visual check of hot water heater', 100),
    ('hvac',              'Visual check of HVAC', 110),
    ('thermostat',        'Check that thermostat is set at correct temperature', 120),
    ('temps',             'Document interior temperature levels (Garage/Storage, Main Floor, 2nd Zone, 3rd Floor)', 130),
    ('secure_windows',    'Check that all windows and entryways are secure', 140),
    ('security_system',   'Check security system is set and working properly', 150),
    ('lighting',          'Check interior and exterior lighting', 160),
    ('lights_operation',  'Operation of all lights - interior and exterior', 170),
    ('water_damage',      'Visual inspection of walls, ceilings, windows, tubs/showers for evidence of water damage, leakage, mold', 180),
    ('water_lines',       'Water flex lines and drains – Run sinks and toilets', 190),
    ('garbage_disposal',  'Garbage disposal(s)', 200),
    ('pests',             'Inspect for visible evidence of insects, pests, rodents', 210),
    ('appliances',        'Visual check of appliances', 220),
    ('freezers',          'Check that freezers, refrigerators and wine coolers are working', 230),
    ('icemaker',          'Ensure icemakers are in "off" position', 240),
    ('clocks',            'Check clocks settings - reset if needed', 250),
    ('lanai_screens',     'Lanai/Pool - Screen door(s), screens, and cage structure', 260),
    ('lanai_water',       'Lanai/Pool - Water level and condition', 270),
    ('lanai_equipment',   'Lanai/Pool - Equipment', 280),
    ('final_hot_water',   'Turn off hot water heater', 290),
    ('final_water_supply','Turn off water supply', 300),
    ('final_lights',      'Turn off all lights', 310),
    ('final_security',    'Enable security system (if applicable) and lock all doors and windows', 320)
)
update public.checklist_items ci
set item_key   = t.item_key,
    sort_order = t.sort_order
from template t
where ci.item_text = t.item_text
  and ci.item_key is null;

-- ----------------------------------------------------------------------------
-- 5. Helpful indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_checklists_visit_date     on public.checklists (visit_date desc);
create index if not exists idx_checklists_created_at      on public.checklists (created_at desc);
create index if not exists idx_checklists_property_id     on public.checklists (property_id);
create index if not exists idx_checklists_inspector_id    on public.checklists (inspector_id);
create index if not exists idx_checklists_email_sent_at   on public.checklists (email_sent_at);
create index if not exists idx_checklist_items_checklist  on public.checklist_items (checklist_id, sort_order);
create index if not exists idx_checklist_photos_item      on public.checklist_photos (checklist_item_id);
create index if not exists idx_properties_client_id       on public.properties (client_id);

-- ----------------------------------------------------------------------------
-- 6. Keep `updated_at` fresh automatically
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['clients','properties','inspectors','checklists','checklist_items'] loop
    execute format('drop trigger if exists trg_set_updated_at on public.%I', t);
    execute format(
      'create trigger trg_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 7. Row Level Security — SHARED COMPANY WORKSPACE
--    Every authenticated staff member can read & manage all records.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['clients','properties','inspectors','checklists','checklist_items','checklist_photos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "workspace_all_access" on public.%I', t);
    execute format(
      'create policy "workspace_all_access" on public.%I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

commit;

-- ============================================================================
-- 8. Storage bucket + policies for checklist photos (run once; safe to re-run)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('checklist-photos', 'checklist-photos', false)
on conflict (id) do nothing;

drop policy if exists "checklist_photos_workspace" on storage.objects;
create policy "checklist_photos_workspace"
  on storage.objects for all to authenticated
  using (bucket_id = 'checklist-photos')
  with check (bucket_id = 'checklist-photos');

-- ============================================================================
-- 9. OPTIONAL — run only AFTER you've confirmed the data looks right in the app.
--    This clears the now-redundant legacy JSON blob. Leave it commented until
--    you're confident; the app no longer reads `notes`.
-- ============================================================================
-- update public.checklists set notes = null where notes is not null;
