-- =====================================================================
--  ЖИШЭЭ ӨГӨГДӨЛ (заавал биш)
--  Хавсаргасан "2025-2026 Хичээлийн хуваарь.xlsx" файлын бүтцээс авав.
--
--  ХЭРХЭН АЖИЛЛУУЛАХ:
--    Доорх :owner хувьсагчийг өөрийн profiles.id (=auth.users.id)-ээр солино.
--    Жишээ нь SQL Editor дээр:
--       select id, email from profiles;
--    гэж хараад id-г хуулж, доорх DO блокийн v_owner-д тавина.
-- =====================================================================

do $$
declare
  v_owner uuid;
  v_subj  jsonb;
  v_room  text;
  v_class text;
  v_grade int;
begin
  -- Хамгийн эхэнд бүртгүүлсэн батлагдсан менежерийг сонгоно
  select id into v_owner from profiles
   where status = 'approved' order by created_at limit 1;

  if v_owner is null then
    raise notice 'Батлагдсан менежер олдсонгүй. Эхлээд бүртгүүлж, админаар батлуулна уу.';
    return;
  end if;

  -- ---------------- Судлагдахуун ----------------
  for v_subj in
    select * from jsonb_array_elements($j$[
      {"n":"Математик","d":"Математик, мэдээллийн технологи","c":"#8257fb","sub":false,"hall":false},
      {"n":"Мэдээллийн технологи","d":"Математик, мэдээллийн технологи","c":"#7434f3","sub":false,"hall":false},
      {"n":"Физик","d":"Хими, Биологи, Физик","c":"#04c8b2","sub":false,"hall":false},
      {"n":"Хими","d":"Хими, Биологи, Физик","c":"#00a091","sub":false,"hall":false},
      {"n":"Биологи","d":"Хими, Биологи, Физик","c":"#1de4cb","sub":false,"hall":false},
      {"n":"Эрүүл мэнд","d":"Хими, Биологи, Физик","c":"#51f7de","sub":false,"hall":false},
      {"n":"Монгол хэл","d":"Монгол хэл","c":"#a47864","sub":false,"hall":false},
      {"n":"Уран зохиол","d":"Монгол хэл","c":"#8d6250","sub":false,"hall":false},
      {"n":"Үндэсний бичиг","d":"Монгол хэл","c":"#b8907a","sub":false,"hall":false},
      {"n":"Англи хэл","d":"Гадаад хэл","c":"#c29948","sub":true,"hall":false},
      {"n":"Орос хэл","d":"Гадаад хэл","c":"#ab7c3c","sub":false,"hall":false},
      {"n":"Түүх","d":"Түүх-НС-Газарзүй","c":"#cdad64","sub":false,"hall":false},
      {"n":"Газарзүй","d":"Түүх-НС-Газарзүй","c":"#dcc891","sub":false,"hall":false},
      {"n":"ИЁЗБ","d":"Түүх-НС-Газарзүй","c":"#eadfbc","sub":false,"hall":false},
      {"n":"Биеийн тамир","d":"Биеийн тамир, Урлаг","c":"#04c8b2","sub":false,"hall":true},
      {"n":"Дүрслэх урлаг","d":"Биеийн тамир, Урлаг","c":"#9f8aff","sub":false,"hall":false},
      {"n":"Хөгжим","d":"Биеийн тамир, Урлаг","c":"#beb4ff","sub":false,"hall":false},
      {"n":"Технологи (эрэгтэй)","d":"Технологи","c":"#744f43","sub":true,"hall":false},
      {"n":"Технологи (эмэгтэй)","d":"Технологи","c":"#d0b4a2","sub":true,"hall":false}
    ]$j$::jsonb)
  loop
    insert into subjects (owner_id, name, department, color, is_subgroup, allow_shared_room, subgroup_kind)
    values (
      v_owner, v_subj->>'n', v_subj->>'d', v_subj->>'c',
      (v_subj->>'sub')::boolean, (v_subj->>'hall')::boolean,
      case when (v_subj->>'sub')::boolean then
        case when v_subj->>'n' like 'Технологи%' then 'tech' else 'language' end
      end
    )
    on conflict (owner_id, name) do nothing;
  end loop;

  -- ---------------- Кабинет ----------------
  foreach v_room in array array[
    '101','103','104','105','106','110',
    '201','204','205','206','207','216','217','218','219','220','221','222','223',
    'Спорт заал','Технологийн танхим 1','Технологийн танхим 2'
  ] loop
    insert into rooms (owner_id, name, is_hall, building)
    values (v_owner, v_room, v_room = 'Спорт заал',
            case when left(v_room,1) = '1' then 'I давхар'
                 when left(v_room,1) = '2' then 'II давхар' else 'Бусад' end)
    on conflict (owner_id, name) do nothing;
  end loop;

  -- ---------------- Анги ----------------
  for v_grade in 5..12 loop
    foreach v_class in array array['а','б','в','г'] loop
      insert into classes (owner_id, name, grade, section, shift, student_count)
      values (v_owner, v_grade::text || v_class, v_grade, v_class,
              case when v_grade <= 6 then 2 else 1 end, 28)
      on conflict (owner_id, name) do nothing;
    end loop;
  end loop;

  -- ---------------- Ээлжийн тохиргоо ----------------
  insert into shift_settings (owner_id, shift, name, start_time, lesson_minutes, break_minutes, periods_per_day, days_per_week)
  values
    (v_owner, 1, '1-р ээлж (өглөө)', '08:00', 40, 10, 7, 5),
    (v_owner, 2, '2-р ээлж (өдөр)',  '13:30', 40, 10, 7, 5),
    (v_owner, 3, '3-р ээлж (орой)',  '17:30', 40, 10, 5, 5)
  on conflict (owner_id, shift) do nothing;

  -- ---------------- Цалингийн тохиргоо ----------------
  insert into payroll_settings (owner_id, overtime_multiplier, homeroom_bonus, room_bonus,
                                zan_bonus, skill_bonus_pct, rank_bonus_argach,
                                rank_bonus_terguuleh, rank_bonus_zovloh)
  values (v_owner, 1.5, 90000, 45000, 60000, 10, 100000, 150000, 200000)
  on conflict (owner_id) do nothing;

  raise notice 'Жишээ өгөгдөл амжилттай нэмэгдлээ. Эзэн: %', v_owner;
end $$;
