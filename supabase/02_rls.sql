-- =====================================================================
--  RLS (Row Level Security) бодлогууд
--  Ажиллуулах дараалал: 01_schema.sql -> 02_rls.sql -> 03_seed.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------
alter table profiles enable row level security;

drop policy if exists "profiles_select_self_or_admin" on profiles;
create policy "profiles_select_self_or_admin" on profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ВАЖНО: role / status-ыг бодлого дотор шалгаж БОЛОХГҮЙ.
-- profiles дээрх policy дотроос profiles-г query хийвэл PostgreSQL
-- "infinite recursion detected in policy" алдаа өгдөг.
-- Тиймээс хамгаалалтыг security definer триггерээр хийнэ.
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Админ бүх талбарыг өөрчилж болно
  if public.is_admin() then
    return new;
  end if;
  -- Энгийн хэрэглэгч эдгээрийг өөрчилж чадахгүй — хуучин утгаар нь буцаана
  new.role          := old.role;
  new.status        := old.status;
  new.approved_at   := old.approved_at;
  new.approved_by   := old.approved_by;
  new.reject_reason := old.reject_reason;
  return new;
end $$;

drop trigger if exists trg_protect_profile on profiles;
create trigger trg_protect_profile
  before update on profiles
  for each row execute function public.protect_profile_fields();

drop policy if exists "profiles_admin_all" on profiles;
create policy "profiles_admin_all" on profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- SCHOOLS — батлагдсан бүх хэрэглэгч уншина, админ бичнэ
-- ---------------------------------------------------------------------
alter table schools enable row level security;

drop policy if exists "schools_read" on schools;
create policy "schools_read" on schools for select using (auth.uid() is not null);

drop policy if exists "schools_admin_write" on schools;
create policy "schools_admin_write" on schools
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- APHORISMS — нээлттэй унших (нүүр хуудсанд харагдана)
-- ---------------------------------------------------------------------
alter table aphorisms enable row level security;

drop policy if exists "aphorisms_read_all" on aphorisms;
create policy "aphorisms_read_all" on aphorisms for select using (true);

drop policy if exists "aphorisms_admin_write" on aphorisms;
create policy "aphorisms_admin_write" on aphorisms
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- AUDIT LOG
-- ---------------------------------------------------------------------
alter table audit_log enable row level security;

drop policy if exists "audit_insert" on audit_log;
create policy "audit_insert" on audit_log for insert with check (auth.uid() is not null);

drop policy if exists "audit_read_admin" on audit_log;
create policy "audit_read_admin" on audit_log
  for select using (public.is_admin() or actor_id = auth.uid());

-- ---------------------------------------------------------------------
-- ӨГӨГДЛИЙН ХҮСНЭГТҮҮД
--  Дүрэм: owner_id = auth.uid() бөгөөд хэрэглэгч БАТЛАГДСАН байх ёстой.
--         Админ бүгдийг харна.
-- ---------------------------------------------------------------------

do $$
declare
  t text;
  owned_tables text[] := array[
    'subjects','classes','rooms','teachers','teacher_subjects','teacher_rooms',
    'teaching_loads','shift_settings','schedule_versions','schedule_slots',
    'plans','plan_items','performance_periods','performance_tasks',
    'payroll_settings','payroll_months','attendance','observations',
    'students','grades'
  ];
begin
  foreach t in array owned_tables loop
    execute format('alter table %I enable row level security', t);

    execute format('drop policy if exists %I on %I', t || '_owner_select', t);
    execute format($f$
      create policy %I on %I for select
      using (owner_id = auth.uid() and public.is_approved() or public.is_admin())
    $f$, t || '_owner_select', t);

    execute format('drop policy if exists %I on %I', t || '_owner_insert', t);
    execute format($f$
      create policy %I on %I for insert
      with check (owner_id = auth.uid() and public.is_approved())
    $f$, t || '_owner_insert', t);

    execute format('drop policy if exists %I on %I', t || '_owner_update', t);
    execute format($f$
      create policy %I on %I for update
      using (owner_id = auth.uid() and public.is_approved() or public.is_admin())
      with check (owner_id = auth.uid() and public.is_approved() or public.is_admin())
    $f$, t || '_owner_update', t);

    execute format('drop policy if exists %I on %I', t || '_owner_delete', t);
    execute format($f$
      create policy %I on %I for delete
      using (owner_id = auth.uid() and public.is_approved() or public.is_admin())
    $f$, t || '_owner_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- owner_id-г автоматаар оноох (клиентээс мартсан ч зөв бөглөгдөнө)
-- ---------------------------------------------------------------------
create or replace function public.set_owner()
returns trigger language plpgsql as $$
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;
  return new;
end $$;

do $$
declare
  t text;
  owned_tables text[] := array[
    'subjects','classes','rooms','teachers','teacher_subjects','teacher_rooms',
    'teaching_loads','shift_settings','schedule_versions','schedule_slots',
    'plans','plan_items','performance_periods','performance_tasks',
    'payroll_settings','payroll_months','attendance','observations',
    'students','grades'
  ];
begin
  foreach t in array owned_tables loop
    execute format('drop trigger if exists trg_set_owner on %I', t);
    execute format(
      'create trigger trg_set_owner before insert on %I for each row execute function public.set_owner()', t);
  end loop;
end $$;
