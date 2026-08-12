-- =====================================================================
--  СУРГАЛТЫН МЕНЕЖЕРИЙН СИСТЕМ — БҮРЭН СУУЛГАЦ (нэг файл)
--
--  ХЭРХЭН АЖИЛЛУУЛАХ:
--    Supabase Dashboard -> SQL Editor -> New query
--    -> энэ файлыг БҮТНЭЭР нь хуулж тавиад RUN дарна.
--
--  Дотор нь: 01_schema.sql + 02_rls.sql + 03_seed.sql
--  Дахин ажиллуулж болно (idempotent).
--
--  Дараагийн алхам: /register-ээр бүртгүүлээд, файлын ТӨГСГӨЛД байгаа
--  админ болгох SQL-ийг өөрийн и-мэйлээр ажиллуулна.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ХЭСЭГ: 01_schema.sql
-- ---------------------------------------------------------------------

-- =====================================================================
--  СУРГАЛТЫН МЕНЕЖЕРИЙН СИСТЕМ — Өгөгдлийн сангийн схем
--  Supabase (PostgreSQL) дээр ажиллана.
--  Ажиллуулах: Supabase Dashboard -> SQL Editor -> энэ файлыг бүтнээр нь
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. ХЭРЭГЛЭГЧ / ЭРХ
-- ---------------------------------------------------------------------

do $$ begin
  create type user_role as enum ('admin', 'manager');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists schools (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  aimag        text,
  soum         text,
  logo_url     text,
  created_at   timestamptz not null default now()
);

create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  last_name     text,                       -- Овог
  first_name    text,                       -- Нэр
  phone         text,
  position      text default 'Сургалтын менежер',
  role          user_role not null default 'manager',
  status        approval_status not null default 'pending',
  school_id     uuid references schools(id) on delete set null,
  school_name   text,                       -- бүртгэлийн үед бичсэн сургуулийн нэр
  approved_at   timestamptz,
  approved_by   uuid references auth.users(id) on delete set null,
  reject_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Шинэ хэрэглэгч бүртгүүлэхэд profiles мөр автоматаар үүснэ (pending төлөвтэй)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, last_name, first_name, phone, school_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'school_name', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Туслах функцууд (RLS дотор recursion үүсгэхгүйн тулд security definer)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and (p.status = 'approved' or p.role = 'admin')
  );
$$;

-- ---------------------------------------------------------------------
-- 2. ЛАВЛАХ ХҮСНЭГТҮҮД
-- ---------------------------------------------------------------------

-- Судлагдахуун (Математик, Монгол хэл, Биологи ...)
create table if not exists subjects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,                       -- Хичээлийн нэр
  department    text,                                -- Судлагдахууны бүлэг
  color         text default '#8257fb',
  is_elective   boolean not null default false,      -- Сонгон судлах эсэх
  is_subgroup   boolean not null default false,      -- Под группээр хуваагдах (Англи хэл, Технологи)
  subgroup_kind text,                                -- 'language' | 'tech_male' | 'tech_female'
  allow_shared_room boolean not null default false,  -- Биеийн тамир — нэг зааланд 2 анги
  created_at    timestamptz not null default now(),
  unique (owner_id, name)
);

-- Анги (6а, 7б, 12а ...)
create table if not exists classes (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,          -- "6а"
  grade         int  not null,          -- 6
  section       text,                   -- "а"
  shift         int  not null default 1,-- 1 / 2 / 3-р ээлж
  student_count int  default 0,
  homeroom_teacher_id uuid,             -- анги даасан багш (teachers.id) — доор FK нэмнэ
  created_at    timestamptz not null default now(),
  unique (owner_id, name)
);

-- Кабинет / танхим
create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,           -- "205", "Спорт заал"
  capacity    int default 30,
  is_hall     boolean not null default false,  -- заал (2 анги зэрэг орж болно)
  building    text,
  created_at  timestamptz not null default now(),
  unique (owner_id, name)
);

-- ---------------------------------------------------------------------
-- 3. БАГШ
-- ---------------------------------------------------------------------

do $$ begin
  create type teacher_rank as enum ('Байхгүй', 'Заах аргач', 'Тэргүүлэх', 'Зөвлөх');
exception when duplicate_object then null; end $$;

create table if not exists teachers (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  last_name      text not null,                    -- Овог
  first_name     text not null,                    -- Нэр
  register_no    text,                             -- РД
  phone          text,
  email          text,
  home_address   text,                             -- Гэрийн хаяг
  birth_date     date,
  hire_date      date,
  years_worked   numeric(5,1) default 0,           -- Ажилласан жил
  rank           teacher_rank not null default 'Байхгүй',
  department     text,                             -- Судлагдахууны нэгдэл
  main_room_id   uuid references rooms(id) on delete set null, -- Үндсэн кабинет
  is_homeroom    boolean not null default false,   -- Анги даасан эсэх
  homeroom_class_id uuid references classes(id) on delete set null,
  base_salary    numeric(12,2) default 0,          -- Үндсэн цалин (сарын)
  hourly_rate    numeric(12,2) default 0,          -- 1 цагийн хөлс
  active         boolean not null default true,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table classes drop constraint if exists classes_homeroom_teacher_fk;
alter table classes add constraint classes_homeroom_teacher_fk
  foreign key (homeroom_teacher_id) references teachers(id) on delete set null;

-- Багш ямар судлагдахуун заадаг
create table if not exists teacher_subjects (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid not null references teachers(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  unique (teacher_id, subject_id)
);

-- Багшийн кабинетийн эрэмбэ (1-рт бичсэн нь давуу эрхтэй, 7 хүртэл)
create table if not exists teacher_rooms (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid not null references teachers(id) on delete cascade,
  room_id    uuid not null references rooms(id) on delete cascade,
  priority   int  not null check (priority between 1 and 7),
  unique (teacher_id, priority),
  unique (teacher_id, room_id)
);

-- Багшийн ачаалал: аль анги, ямар хичээл, 7 хоногт хэдэн цаг
create table if not exists teaching_loads (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  teacher_id    uuid not null references teachers(id) on delete cascade,
  subject_id    uuid not null references subjects(id) on delete cascade,
  class_id      uuid not null references classes(id) on delete cascade,
  hours_per_week numeric(4,1) not null default 1,  -- 7 хоногт орох цаг
  is_elective   boolean not null default false,     -- сонгон судлах цаг эсэх
  subgroup      text,                               -- 'A' / 'B' — под групп
  created_at    timestamptz not null default now()
);

create unique index if not exists uq_teaching_load
  on teaching_loads(teacher_id, subject_id, class_id, coalesce(subgroup, '-'));

-- ---------------------------------------------------------------------
-- 4. ХИЧЭЭЛИЙН ХУВААРЬ
-- ---------------------------------------------------------------------

-- Ээлж бүрийн тохиргоо: эхлэх цаг, хичээлийн урт, завсарлага
create table if not exists shift_settings (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  shift          int not null check (shift between 1 and 3),
  name           text not null,                    -- "1-р ээлж (өглөө)"
  start_time     time not null default '08:00',
  lesson_minutes int  not null default 40,
  break_minutes  int  not null default 10,
  long_break_after int default 3,                  -- хэддэх цагийн дараа урт завсарлага
  long_break_minutes int default 20,
  periods_per_day int not null default 7,
  days_per_week  int not null default 5,           -- 5 эсвэл 6 хоног
  active         boolean not null default true,
  unique (owner_id, shift)
);

-- Хуваарийн хувилбар (олон хувилбар хадгалж болно)
create table if not exists schedule_versions (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  school_year  text not null default '2025-2026',
  semester     int  not null default 1,
  is_active    boolean not null default false,
  pe_shared_hall boolean not null default true,    -- Биеийн тамир нэг зааланд 2 анги
  notes        text,
  created_at   timestamptz not null default now()
);

-- Хуваарийн нэг нүд
create table if not exists schedule_slots (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  version_id  uuid not null references schedule_versions(id) on delete cascade,
  teacher_id  uuid not null references teachers(id) on delete cascade,
  subject_id  uuid not null references subjects(id) on delete cascade,
  class_id    uuid not null references classes(id) on delete cascade,
  room_id     uuid references rooms(id) on delete set null,
  shift       int  not null default 1,
  day_of_week int  not null check (day_of_week between 1 and 6),  -- 1=Даваа
  period      int  not null check (period between 1 and 12),      -- I..VII
  is_elective boolean not null default false,
  subgroup    text,
  locked      boolean not null default false,   -- гараар бэхэлсэн нүд
  created_at  timestamptz not null default now()
);

create index if not exists idx_slots_version on schedule_slots(version_id);
create index if not exists idx_slots_teacher on schedule_slots(version_id, teacher_id, day_of_week, period);
create index if not exists idx_slots_class   on schedule_slots(version_id, class_id, day_of_week, period);
create index if not exists idx_slots_room    on schedule_slots(version_id, room_id, day_of_week, period);

-- Багш нэг үед хоёр газар байж болохгүй
create unique index if not exists uq_slot_teacher
  on schedule_slots(version_id, teacher_id, shift, day_of_week, period);

-- Анги нэг үед нэг л хичээлтэй (под групп нь subgroup-аар ялгарна)
create unique index if not exists uq_slot_class
  on schedule_slots(version_id, class_id, shift, day_of_week, period, coalesce(subgroup, '-'));

-- ---------------------------------------------------------------------
-- 5. МЕНЕЖЕРИЙН ТӨЛӨВЛӨГӨӨ
-- ---------------------------------------------------------------------

do $$ begin
  create type plan_period as enum ('year', 'quarter', 'month', 'week');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_status as enum ('planned', 'in_progress', 'done', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists plans (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  period       plan_period not null,
  school_year  text not null default '2025-2026',
  quarter      int,          -- 1..4
  month        int,          -- 1..12
  week         int,          -- 1..52
  title        text not null,
  goal         text,         -- Зорилго
  start_date   date,
  end_date     date,
  created_at   timestamptz not null default now()
);

create table if not exists plan_items (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  plan_id     uuid not null references plans(id) on delete cascade,
  seq         int not null default 1,
  activity    text not null,        -- Хийх ажил
  responsible text,                 -- Хариуцах эзэн
  due_date    date,
  indicator   text,                 -- Гүйцэтгэлийн шалгуур
  budget      numeric(12,2),
  status      plan_status not null default 'planned',
  progress    int not null default 0 check (progress between 0 and 100),
  note        text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. БАГШИЙН АЖЛЫН ГҮЙЦЭТГЭЛ
-- ---------------------------------------------------------------------

create table if not exists performance_periods (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,             -- "2025-2026 I улирал"
  school_year text not null default '2025-2026',
  start_date  date,
  end_date    date,
  max_score   numeric(6,2) default 100,
  created_at  timestamptz not null default now()
);

create table if not exists performance_tasks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  period_id   uuid references performance_periods(id) on delete cascade,
  teacher_id  uuid not null references teachers(id) on delete cascade,
  plan_item_id uuid references plan_items(id) on delete set null,  -- төлөвлөгөөнөөс сонгосон
  title       text not null,            -- Гүйцэтгэх ажил
  category    text,                     -- Ангилал
  due_date    date,
  is_done     boolean not null default false,   -- Чек
  done_at     timestamptz,
  score       numeric(6,2),             -- Оноо
  max_score   numeric(6,2) default 10,
  comment     text,                     -- Тайлбар
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. ЦАГИЙН ТООЦОО / ЦАЛИН
-- ---------------------------------------------------------------------
-- Excel "Цагийн тооцооны хуудас"-ны бүтцийг дагасан

create table if not exists payroll_settings (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references auth.users(id) on delete cascade unique,
  school_year           text not null default '2025-2026',
  overtime_multiplier   numeric(5,2) not null default 1.5,   -- Илүү цагийн коэффициент
  homeroom_bonus        numeric(12,2) not null default 0,    -- Анги даалт
  room_bonus            numeric(12,2) not null default 0,    -- Кабинет
  zan_bonus             numeric(12,2) not null default 0,    -- ЗАН (заах аргын нэгдэл)
  skill_bonus_pct       numeric(5,2)  not null default 0,    -- Ур чадварын нэмэгдэл %
  rank_bonus_argach     numeric(12,2) not null default 0,    -- Заах аргач
  rank_bonus_terguuleh  numeric(12,2) not null default 0,    -- Тэргүүлэх
  rank_bonus_zovloh     numeric(12,2) not null default 0,    -- Зөвлөх
  ndsh_pct              numeric(5,2)  not null default 11.5, -- НДШ %
  hhoat_pct             numeric(5,2)  not null default 10,   -- ХХОАТ %
  hhoat_deduction       numeric(12,2) not null default 20000,-- Татварын хөнгөлөлт
  updated_at            timestamptz not null default now()
);

create table if not exists payroll_months (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users(id) on delete cascade,
  teacher_id         uuid not null references teachers(id) on delete cascade,
  school_year        text not null default '2025-2026',
  month              int not null check (month between 1 and 12),
  month_label        text,             -- "IX", "X" ...
  work_days          numeric(5,1) default 0,   -- Ажиллах өдөр
  work_hours         numeric(6,1) default 0,   -- Ажиллах цаг
  actual_days        numeric(5,1) default 0,   -- Ажилласан өдөр
  actual_hours       numeric(6,1) default 0,   -- Ажилласан цаг
  -- СХА (сургалтын хөтөлбөрийн ажил) задаргаа
  sha_program_hours  numeric(6,1) default 0,   -- Хөтөлбөр боловсруулах цаг
  sha_improve_hours  numeric(6,1) default 0,   -- Хөтөлбөрөө сайжруулах цаг
  sha_other_hours    numeric(6,1) default 0,   -- Бусад ажил
  sha_teach_hours    numeric(6,1) default 0,   -- Хичээл заах цаг
  taught_hours       numeric(6,1) default 0,   -- Хичээл заасан цаг
  substitute_hours   numeric(6,1) default 0,   -- Орлон заасан цаг
  overtime_hours     numeric(6,1) default 0,   -- Илүү цаг
  -- Нэмэгдэл хөлс
  bonus_homeroom     numeric(12,2) default 0,
  bonus_room         numeric(12,2) default 0,
  bonus_zan          numeric(12,2) default 0,
  bonus_skill        numeric(12,2) default 0,
  bonus_rank         numeric(12,2) default 0,
  vacation_amount    numeric(12,2) default 0,  -- Амралт
  deduction_other    numeric(12,2) default 0,
  note               text,
  created_at         timestamptz not null default now(),
  unique (teacher_id, school_year, month)
);

-- Ирцийн бүртгэл (Excel Sheet3 — 8:00 / 13:00 / 14:00 / 17:00)
create table if not exists attendance (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  teacher_id  uuid not null references teachers(id) on delete cascade,
  date        date not null,
  slot_0800   text,     -- '+' ирсэн, 'Ч' чөлөө, 'Ө' өвчтэй, '-' тасалсан
  slot_1300   text,
  slot_1400   text,
  slot_1700   text,
  note        text,
  unique (teacher_id, date)
);

-- ---------------------------------------------------------------------
-- 8. ХИЧЭЭЛИЙН АЖИГЛАЛТЫН ТЭМДЭГЛЭЛ
-- ---------------------------------------------------------------------

create table if not exists observations (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  teacher_id    uuid not null references teachers(id) on delete cascade,
  class_id      uuid references classes(id) on delete set null,
  subject_id    uuid references subjects(id) on delete set null,
  observed_date date not null default current_date,
  period        int,                   -- хэддэх цаг
  start_time    time,
  topic         text,                  -- Хичээлийн сэдэв
  note          text,                  -- Тэмдэглэл
  strengths     text,                  -- Давуу тал
  suggestions   text,                  -- Зөвлөмж
  score         numeric(6,2),
  observer      text,                  -- Ажигласан хүн
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 9. ДҮНГИЙН НЭГДСЭН МАТРИЦ
-- ---------------------------------------------------------------------

create table if not exists students (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  class_id   uuid not null references classes(id) on delete cascade,
  last_name  text,
  first_name text not null,
  student_no text,
  gender     text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_students_class on students(class_id);

create table if not exists grades (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  subject_id  uuid not null references subjects(id) on delete cascade,
  school_year text not null default '2025-2026',
  quarter     int not null check (quarter between 1 and 4),
  score       numeric(5,2) check (score >= 0 and score <= 100),
  letter      text,          -- A/B/C/D/F — автоматаар бодогдоно
  note        text,
  created_at  timestamptz not null default now(),
  unique (student_id, subject_id, school_year, quarter)
);

-- Оноог үсгэн үнэлгээ рүү хөрвүүлэх
create or replace function public.calc_letter()
returns trigger language plpgsql as $$
begin
  new.letter := case
    when new.score is null then null
    when new.score >= 90 then 'A'
    when new.score >= 80 then 'B'
    when new.score >= 70 then 'C'
    when new.score >= 60 then 'D'
    else 'F' end;
  return new;
end $$;

drop trigger if exists trg_grade_letter on grades;
create trigger trg_grade_letter before insert or update on grades
  for each row execute function public.calc_letter();

-- ---------------------------------------------------------------------
-- 10. АФОРИЗМ (нүүр хуудасны урам зоригийн үг)
-- ---------------------------------------------------------------------

create table if not exists aphorisms (
  id       uuid primary key default gen_random_uuid(),
  text     text not null,
  author   text,
  active   boolean not null default true
);

-- Seed-ийг дахин ажиллуулахад давхардахгүй байх
create unique index if not exists uq_aphorism_text on aphorisms(text);

-- ---------------------------------------------------------------------
-- 11. ХАНДАЛТЫН ЖУРНАЛ
-- ---------------------------------------------------------------------

create table if not exists audit_log (
  id         bigserial primary key,
  actor_id   uuid references auth.users(id) on delete set null,
  action     text not null,
  entity     text,
  entity_id  text,
  detail     jsonb,
  created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- ХЭСЭГ: 02_rls.sql
-- ---------------------------------------------------------------------

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


-- ---------------------------------------------------------------------
-- ХЭСЭГ: 03_seed.sql
-- ---------------------------------------------------------------------

-- =====================================================================
--  Эхлэлийн өгөгдөл (seed)
-- =====================================================================

-- Урам зоригийн афоризмууд — нүүр хуудсанд эргэлдэж харагдана
insert into aphorisms (text, author) values
  ('Багш бол ирээдүйг өнөөдөр бүтээж буй цорын ганц мэргэжил.', 'Кристa МакОлифф'),
  ('Сургалтын чанар нь багшийн чанараас хэтэрдэггүй.', 'Андреас Шляйхер'),
  ('Төлөвлөгөөгүй зорилго бол зүгээр л хүсэл.', 'Антуан де Сент-Экзюпери'),
  ('Хүүхэд бүр авьяастай. Зөвхөн түүнийг олж харах нүд хэрэгтэй.', 'Ж.Батсуурь'),
  ('Хамгийн сайн удирдагч бол бусдыг удирдагч болгож чаддаг хүн.', 'Том Питерс'),
  ('Өнөөдөр хийж чадах зүйлээ маргааш руу бүү хойшлуул.', 'Ардын зүйр үг'),
  ('Боловсрол бол дэлхийг өөрчлөх хамгийн хүчирхэг зэвсэг юм.', 'Нельсон Мандела'),
  ('Сайн зохион байгуулалт бол хийсэн ажлын тал хувь нь.', 'Питер Дракер'),
  ('Хэмжиж чадахгүй зүйлээ удирдаж чадахгүй.', 'Питер Дракер'),
  ('Сурах гэдэг бол сав дүүргэх биш, гал асаах явдал.', 'Плутарх'),
  ('Багшийн нэг сайхан үг сурагчийн бүхэл бүтэн амьдралыг өөрчилдөг.', 'Ц.Дамдинсүрэн'),
  ('Хамт олон нэг зорилготой бол боломжгүй зүйл гэж үгүй.', 'Хэнри Форд')
on conflict do nothing;

-- =====================================================================
--  АНХНЫ АДМИН ҮҮСГЭХ
--  1) Эхлээд Supabase Dashboard -> Authentication -> Users -> Add user
--     эсвэл вэб сайтын /register хуудсаар бүртгүүлнэ.
--  2) Дараа нь доорх мөрийг өөрийн и-мэйлээр солиод ажиллуулна.
-- =====================================================================

-- update profiles
--    set role = 'admin', status = 'approved', approved_at = now()
--  where email = 'ТАНЫ_ИМЭЙЛ@example.com';



-- ---------------------------------------------------------------------
-- СҮҮЛИЙН АЛХАМ: АНХНЫ АДМИН
-- ---------------------------------------------------------------------
-- Дээрх бүхнийг ажиллуулсны дараа:
--   1) Вэб сайтын /register хуудсаар бүртгүүлнэ
--   2) Доорх мөрийн и-мэйлийг ӨӨРИЙНХӨӨР солиод, тайлбарыг арилгаж ажиллуулна
--
-- update profiles
--    set role = 'admin', status = 'approved', approved_at = now()
--  where email = 'ТАНЫ_ИМЭЙЛ@example.com';
--
-- Шалгах:
--   select email, role, status from profiles;
-- ---------------------------------------------------------------------
