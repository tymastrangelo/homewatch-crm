-- ============================================================================
-- 239 Home Services CRM — RLS consolidation / cleanup
-- ----------------------------------------------------------------------------
-- Earlier iterations left many overlapping Row Level Security policies on each
-- table (per-user policies, duplicate "authenticated" policies, and a couple of
-- public/anon-accessible ones). This collapses them to exactly ONE policy per
-- table — the shared-workspace model — and removes anonymous access.
--
-- Net effect: signed-in staff keep full access; logged-out (anon) requests can
-- no longer read or write anything. Safe + idempotent.
-- ============================================================================

begin;

-- 1. Public tables: drop every existing policy, then create the single
--    shared-workspace policy.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['clients','properties','inspectors','checklists','checklist_items','checklist_photos'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "workspace_all_access" on public.%I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

commit;

-- 2. Storage: keep a single authenticated policy for the checklist-photos
--    bucket; drop the legacy ones (including public/anon-accessible ones).
drop policy if exists "Allow authenticated users to upload photos" on storage.objects;
drop policy if exists "Allow authenticated users to view photos" on storage.objects;
drop policy if exists "Users can upload their own checklist photos" on storage.objects;
drop policy if exists "Users can view their own checklist photos" on storage.objects;

drop policy if exists "checklist_photos_workspace" on storage.objects;
create policy "checklist_photos_workspace"
  on storage.objects for all to authenticated
  using (bucket_id = 'checklist-photos')
  with check (bucket_id = 'checklist-photos');
