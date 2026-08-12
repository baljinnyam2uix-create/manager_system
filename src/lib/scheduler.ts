/**
 * =====================================================================
 *  ХИЧЭЭЛИЙН ХУВААРЬ ЗОХИОХ АЛГОРИТМ
 * =====================================================================
 *  Хязгаарлалтууд (хатуу):
 *   1. Нэг багш нэг үед зөвхөн нэг ангид орно
 *   2. Нэг анги нэг үед зөвхөн нэг хичээлтэй (под групп нь үл хамаарна)
 *   3. Нэг кабинетэд нэг үед зөвхөн нэг хичээл
 *      — Биеийн тамирын заалд 2 анги зэрэг орж болно (тохиргоотой)
 *   4. 7 хоногийн нийт цаг яг таарна — хэтрэхгүй, дутахгүй
 *   5. Под группийн хичээл (Англи хэл, эрэгтэй/эмэгтэй технологи) ЗААВАЛ
 *      зэрэгцэж, ижил өдөр/цагт орно
 *
 *  Зөөлөн шалгуур (оноогоор):
 *   - Багшийн 1-р кабинет хамгийн өндөр оноотой, 7 хүртэл эрэмбээр буурна
 *   - Нэг хичээл нэг өдөр давтагдахгүй байх
 *   - Багшид "цонх" (чөлөөт цаг) бага байх
 *   - Ангийн хичээл өглөөний эхний цагуудад төвлөрөх
 *   - Биеийн тамирын хосолсон анги үе ойролцоо байх
 * =====================================================================
 */

import type {
  ClassRoom,
  Room,
  ScheduleSlot,
  ShiftSetting,
  Subject,
  Teacher,
  TeachingLoad,
} from "./types";

export interface SchedulerInput {
  teachers: Teacher[];
  classes: ClassRoom[];
  rooms: Room[];
  subjects: Subject[];
  loads: TeachingLoad[];
  shifts: ShiftSetting[];
  /** teacher_id -> [room_id эрэмбээр 1..7] */
  teacherRooms: Record<string, string[]>;
  /** Биеийн тамир — нэг зааланд 2 анги зэрэг */
  peSharedHall: boolean;
  /** Гараар бэхэлсэн, хөдөлгөхгүй нүднүүд */
  lockedSlots?: Partial<ScheduleSlot>[];
  /** Хэдэн удаа дахин оролдох (их бол чанар сайжирна, удаан болно) */
  attempts?: number;
  seed?: number;
}

export interface PlacedSlot {
  teacher_id: string;
  subject_id: string;
  class_id: string;
  room_id: string | null;
  shift: number;
  day_of_week: number;
  period: number;
  is_elective: boolean;
  subgroup: string | null;
  locked: boolean;
}

export interface UnplacedItem {
  teacherName: string;
  subjectName: string;
  className: string;
  hours: number;
  reason: string;
}

export interface SchedulerResult {
  slots: PlacedSlot[];
  unplaced: UnplacedItem[];
  score: number;
  stats: {
    totalRequired: number;
    totalPlaced: number;
    teacherGaps: number;
    roomPriorityHits: number;
    sameDayRepeats: number;
    elapsedMs: number;
  };
}

// ---------------------------------------------------------------------
// Санамсаргүй тоо (үр дүнг давтахын тулд seed-тэй)
// ---------------------------------------------------------------------
function makeRng(seed: number) {
  let s = seed >>> 0 || 12345;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------
// Байрлуулах нэгж — нэг (өдөр, цаг) дээр суух ажил
// ---------------------------------------------------------------------
interface Piece {
  load: TeachingLoad;
  teacherId: string;
  subjectId: string;
  classId: string;
  subgroup: string | null;
  isElective: boolean;
  needsHall: boolean;
}

interface Unit {
  key: string;
  /** 'single' | 'parallel' (под групп) | 'shared' (заал хуваалцсан) */
  kind: "single" | "parallel" | "shared";
  pieces: Piece[];
  shift: number;
  /** эрэмбэлэх жин — их бол эрт байрлуулна */
  weight: number;
}

// ---------------------------------------------------------------------
// Гол функц
// ---------------------------------------------------------------------
export function generateSchedule(input: SchedulerInput): SchedulerResult {
  const t0 = Date.now();
  const attempts = Math.max(1, input.attempts ?? 14);

  let best: SchedulerResult | null = null;

  for (let a = 0; a < attempts; a++) {
    const res = runOnce(input, (input.seed ?? 20252026) + a * 7919);
    if (
      !best ||
      res.unplaced.length < best.unplaced.length ||
      (res.unplaced.length === best.unplaced.length && res.score > best.score)
    ) {
      best = res;
    }
    if (best.unplaced.length === 0 && a >= 3) break; // хангалттай сайн
  }

  best!.stats.elapsedMs = Date.now() - t0;
  return best!;
}

function runOnce(input: SchedulerInput, seed: number): SchedulerResult {
  const rnd = makeRng(seed);
  const {
    teachers,
    classes,
    rooms,
    subjects,
    loads,
    shifts,
    teacherRooms,
    peSharedHall,
  } = input;

  const subjById = new Map(subjects.map((s) => [s.id, s]));
  const clsById = new Map(classes.map((c) => [c.id, c]));
  const tchById = new Map(teachers.map((t) => [t.id, t]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const shiftByNo = new Map(shifts.map((s) => [s.shift, s]));

  const halls = rooms.filter((r) => r.is_hall);

  // ---------- 1. Нэгжүүд бэлдэх ----------
  const units = buildUnits({
    loads,
    subjById,
    clsById,
    peSharedHall,
    hallsAvailable: halls.length > 0,
  });

  // ---------- 2. Эзэлхүүний газрын зураг ----------
  // түлхүүр: `${shift}:${day}:${period}`
  const teacherBusy = new Map<string, Set<string>>(); // teacherId -> Set<slotKey>
  const classBusy = new Map<string, Set<string>>();
  const roomUse = new Map<string, number>(); // `${roomId}|${slotKey}` -> тоо
  const classSubjectDay = new Map<string, number>(); // `${classId}|${subjectId}|${shift}:${day}` -> тоо

  const placed: PlacedSlot[] = [];
  const unplaced: UnplacedItem[] = [];

  // Бэхлэгдсэн нүднүүдийг эхэлж бүртгэнэ
  for (const ls of input.lockedSlots || []) {
    if (!ls.teacher_id || !ls.class_id || ls.day_of_week == null || ls.period == null)
      continue;
    const key = slotKey(ls.shift ?? 1, ls.day_of_week, ls.period);
    addTo(teacherBusy, ls.teacher_id, key);
    addTo(classBusy, ls.class_id, key);
    if (ls.room_id) bump(roomUse, `${ls.room_id}|${key}`);
    bumpMap(
      classSubjectDay,
      `${ls.class_id}|${ls.subject_id}|${ls.shift ?? 1}:${ls.day_of_week}`
    );
    placed.push({
      teacher_id: ls.teacher_id,
      subject_id: ls.subject_id!,
      class_id: ls.class_id,
      room_id: ls.room_id ?? null,
      shift: ls.shift ?? 1,
      day_of_week: ls.day_of_week,
      period: ls.period,
      is_elective: !!ls.is_elective,
      subgroup: ls.subgroup ?? null,
      locked: true,
    });
  }

  // ---------- 3. Эрэмбэлэх: хамгийн хязгаарлагдмал нь эхэлнэ ----------
  const ordered = shuffle(units, rnd).sort((x, y) => y.weight - x.weight);

  let roomPriorityHits = 0;
  let sameDayRepeats = 0;

  // ---------- 4. Байрлуулах ----------
  for (const unit of ordered) {
    const st = shiftByNo.get(unit.shift) || shifts[0];
    if (!st) {
      unplaced.push(describeUnplaced(unit, tchById, subjById, clsById, "Ээлжийн тохиргоо байхгүй"));
      continue;
    }
    const days = st.days_per_week || 5;
    const periods = st.periods_per_day || 7;

    // Боломжит (өдөр, цаг) хосуудыг оноогоор эрэмбэлнэ
    const candidates: { day: number; period: number; score: number; rooms: (string | null)[] }[] = [];

    for (let day = 1; day <= days; day++) {
      for (let period = 1; period <= periods; period++) {
        const key = slotKey(unit.shift, day, period);

        // Хатуу: багш, анги сул эсэх
        let ok = true;
        for (const p of unit.pieces) {
          if (teacherBusy.get(p.teacherId)?.has(key)) { ok = false; break; }
          if (classBusy.get(p.classId)?.has(key)) { ok = false; break; }
        }
        if (!ok) continue;

        // Нэг под группийн хоёр багш нэг байх ёсгүй
        const tids = unit.pieces.map((p) => p.teacherId);
        if (new Set(tids).size !== tids.length) continue;
        const cids = unit.pieces.map((p) => p.classId);
        if (unit.kind !== "shared" && new Set(cids).size !== cids.length && unit.kind !== "parallel") continue;

        // Кабинет хуваарилах
        const assign = assignRooms(unit, key, {
          roomUse,
          roomById,
          rooms,
          halls,
          teacherRooms,
          peSharedHall,
        });
        if (!assign) continue;

        // ---- Зөөлөн оноо ----
        let score = 0;

        // Кабинетийн эрэмбэ (1-р кабинет = 70 оноо, 7-р = 10)
        score += assign.priorityScore;

        // Нэг өдөр давтагдахгүй
        let repeat = 0;
        for (const p of unit.pieces) {
          const dk = `${p.classId}|${p.subjectId}|${unit.shift}:${day}`;
          repeat += classSubjectDay.get(dk) || 0;
        }
        score -= repeat * 45;

        // Өглөөний эхний цагуудыг илүүд үзнэ
        score += (periods - period) * 4;

        // Ангийн хичээл цуварсан байх (өмнөх/дараах цаг дүүрэн бол сайн)
        for (const p of unit.pieces) {
          const prev = classBusy.get(p.classId)?.has(slotKey(unit.shift, day, period - 1));
          const next = classBusy.get(p.classId)?.has(slotKey(unit.shift, day, period + 1));
          if (prev) score += 12;
          if (next) score += 8;
        }

        // Багшид цонх үүсгэхгүй байх
        for (const p of unit.pieces) {
          const prev = teacherBusy.get(p.teacherId)?.has(slotKey(unit.shift, day, period - 1));
          const next = teacherBusy.get(p.teacherId)?.has(slotKey(unit.shift, day, period + 1));
          if (prev) score += 10;
          if (next) score += 6;
        }

        // Заал хуваалцсан бол үе ойролцоо анги нэмэлт оноо
        if (unit.kind === "shared" && unit.pieces.length === 2) {
          const g1 = clsById.get(unit.pieces[0].classId)?.grade ?? 0;
          const g2 = clsById.get(unit.pieces[1].classId)?.grade ?? 0;
          score += Math.max(0, 30 - Math.abs(g1 - g2) * 10);
        }

        // Бага зэрэг санамсаргүй байдал — олон хувилбар шалгах боломж
        score += rnd() * 6;

        candidates.push({ day, period, score, rooms: assign.rooms });
      }
    }

    if (candidates.length === 0) {
      unplaced.push(
        describeUnplaced(unit, tchById, subjById, clsById, "Сул цаг/кабинет олдсонгүй")
      );
      continue;
    }

    candidates.sort((a, b) => b.score - a.score);
    const pick = candidates[0];
    const key = slotKey(unit.shift, pick.day, pick.period);

    unit.pieces.forEach((p, i) => {
      addTo(teacherBusy, p.teacherId, key);
      addTo(classBusy, p.classId, key);
      const rid = pick.rooms[i];
      if (rid) {
        bump(roomUse, `${rid}|${key}`);
        const prio = (teacherRooms[p.teacherId] || []).indexOf(rid);
        if (prio === 0) roomPriorityHits++;
      }
      const dk = `${p.classId}|${p.subjectId}|${unit.shift}:${pick.day}`;
      if ((classSubjectDay.get(dk) || 0) > 0) sameDayRepeats++;
      bumpMap(classSubjectDay, dk);

      placed.push({
        teacher_id: p.teacherId,
        subject_id: p.subjectId,
        class_id: p.classId,
        room_id: rid,
        shift: unit.shift,
        day_of_week: pick.day,
        period: pick.period,
        is_elective: p.isElective,
        subgroup: p.subgroup,
        locked: false,
      });
    });
  }

  // ---------- 5. Үнэлгээ ----------
  const teacherGaps = countGaps(placed, shifts);
  const totalRequired = units.reduce((s, u) => s + u.pieces.length, 0);
  const totalPlaced = placed.filter((p) => !p.locked).length;

  const score =
    totalPlaced * 100 -
    unplaced.length * 500 -
    teacherGaps * 8 -
    sameDayRepeats * 20 +
    roomPriorityHits * 6;

  return {
    slots: placed,
    unplaced,
    score,
    stats: {
      totalRequired,
      totalPlaced,
      teacherGaps,
      roomPriorityHits,
      sameDayRepeats,
      elapsedMs: 0,
    },
  };
}

// ---------------------------------------------------------------------
// Нэгж бүрдүүлэх — под групп болон заал хуваалцах логик
// ---------------------------------------------------------------------
function buildUnits(args: {
  loads: TeachingLoad[];
  subjById: Map<string, Subject>;
  clsById: Map<string, ClassRoom>;
  peSharedHall: boolean;
  hallsAvailable: boolean;
}): Unit[] {
  const { loads, subjById, clsById, peSharedHall, hallsAvailable } = args;
  const units: Unit[] = [];

  // Багш/ангийн ачаалал — жин тооцоход
  const teacherLoad = new Map<string, number>();
  const classLoad = new Map<string, number>();
  for (const l of loads) {
    teacherLoad.set(l.teacher_id, (teacherLoad.get(l.teacher_id) || 0) + Number(l.hours_per_week));
    classLoad.set(l.class_id, (classLoad.get(l.class_id) || 0) + Number(l.hours_per_week));
  }

  const used = new Set<string>(); // ашигласан "load:index" цагууд

  const pieceOf = (l: TeachingLoad): Piece => {
    const s = subjById.get(l.subject_id);
    return {
      load: l,
      teacherId: l.teacher_id,
      subjectId: l.subject_id,
      classId: l.class_id,
      subgroup: l.subgroup,
      isElective: l.is_elective || !!s?.is_elective,
      needsHall: !!s?.allow_shared_room,
    };
  };

  const weightOf = (pieces: Piece[]) =>
    pieces.reduce(
      (m, p) =>
        Math.max(
          m,
          (teacherLoad.get(p.teacherId) || 0) + (classLoad.get(p.classId) || 0)
        ),
      0
    ) + pieces.length * 3;

  // ---- (A) ПОД ГРУПП: нэг анги, ижил төрлийн хичээл, өөр багш → зэрэгцүүлнэ ----
  const subgroupBuckets = new Map<string, TeachingLoad[]>();
  for (const l of loads) {
    const s = subjById.get(l.subject_id);
    if (!s?.is_subgroup) continue;
    const kind = s.subgroup_kind || s.department || s.name;
    const k = `${l.class_id}|${kind}`;
    if (!subgroupBuckets.has(k)) subgroupBuckets.set(k, []);
    subgroupBuckets.get(k)!.push(l);
  }

  for (const [, bucket] of subgroupBuckets) {
    if (bucket.length < 2) continue; // хос болохгүй бол дан хичээл болно
    // Зэрэгцүүлэх боломжтой цагийн тоо = хамгийн бага цагтай нь
    const pairCount = Math.floor(Math.min(...bucket.map((l) => Number(l.hours_per_week))));
    for (let h = 0; h < pairCount; h++) {
      const pieces = bucket.map(pieceOf);
      units.push({
        key: `sub-${bucket[0].class_id}-${h}`,
        kind: "parallel",
        pieces,
        shift: clsById.get(bucket[0].class_id)?.shift ?? 1,
        weight: weightOf(pieces) + 1000, // под групп хамгийн эхэнд
      });
      for (const l of bucket) used.add(`${l.id}:${h}`);
    }
  }

  // ---- (B) ЗААЛ ХУВААЛЦАХ (Биеийн тамир) ----
  if (peSharedHall && hallsAvailable) {
    const hallLoads = loads.filter((l) => {
      const s = subjById.get(l.subject_id);
      return s?.allow_shared_room;
    });

    // Үе ойролцоо ангиудыг хослуулна
    const byGrade = [...hallLoads].sort((a, b) => {
      const ga = clsById.get(a.class_id)?.grade ?? 0;
      const gb = clsById.get(b.class_id)?.grade ?? 0;
      if (ga !== gb) return ga - gb;
      return (clsById.get(a.class_id)?.name || "").localeCompare(
        clsById.get(b.class_id)?.name || ""
      );
    });

    // Үлдсэн цагийн тоог мөрдөнө
    const remain = new Map<string, number>();
    for (const l of byGrade) {
      let r = Math.floor(Number(l.hours_per_week));
      for (let h = 0; h < r; h++) if (used.has(`${l.id}:${h}`)) r--;
      remain.set(l.id, r);
    }

    for (let i = 0; i < byGrade.length; i++) {
      const A = byGrade[i];
      while ((remain.get(A.id) || 0) > 0) {
        // Хамгийн ойрын үетэй, өөр ангийн, өөр багштай хосыг хайна
        let partner: TeachingLoad | null = null;
        let bestDiff = Infinity;
        for (let j = i + 1; j < byGrade.length; j++) {
          const B = byGrade[j];
          if ((remain.get(B.id) || 0) <= 0) continue;
          if (B.class_id === A.class_id) continue;
          if (B.teacher_id === A.teacher_id) continue; // нэг багш 2 анги нэгэн зэрэг заана гэж үзэхгүй
          const diff = Math.abs(
            (clsById.get(A.class_id)?.grade ?? 0) - (clsById.get(B.class_id)?.grade ?? 0)
          );
          if (diff < bestDiff) { bestDiff = diff; partner = B; }
          if (diff === 0) break;
        }

        const idxA = Math.floor(Number(A.hours_per_week)) - (remain.get(A.id) || 0);
        if (partner) {
          const idxB = Math.floor(Number(partner.hours_per_week)) - (remain.get(partner.id) || 0);
          const pieces = [pieceOf(A), pieceOf(partner)];
          units.push({
            key: `hall-${A.id}-${idxA}`,
            kind: "shared",
            pieces,
            shift: clsById.get(A.class_id)?.shift ?? 1,
            weight: weightOf(pieces) + 500,
          });
          used.add(`${A.id}:${idxA}`);
          used.add(`${partner.id}:${idxB}`);
          remain.set(A.id, (remain.get(A.id) || 0) - 1);
          remain.set(partner.id, (remain.get(partner.id) || 0) - 1);
        } else {
          // Хос олдсонгүй — дан орно
          const pieces = [pieceOf(A)];
          units.push({
            key: `hall1-${A.id}-${idxA}`,
            kind: "single",
            pieces,
            shift: clsById.get(A.class_id)?.shift ?? 1,
            weight: weightOf(pieces) + 400,
          });
          used.add(`${A.id}:${idxA}`);
          remain.set(A.id, (remain.get(A.id) || 0) - 1);
        }
      }
    }
  }

  // ---- (C) ҮЛДСЭН БҮХ ЦАГ — дан нэгж ----
  for (const l of loads) {
    const total = Math.round(Number(l.hours_per_week) * 2) / 2; // 0.5 нарийвчлал
    const whole = Math.floor(total);
    const half = total - whole >= 0.5 ? 1 : 0; // 0.5 цагийг бүтэн цаг болгон авна
    for (let h = 0; h < whole + half; h++) {
      if (used.has(`${l.id}:${h}`)) continue;
      const pieces = [pieceOf(l)];
      units.push({
        key: `s-${l.id}-${h}`,
        kind: "single",
        pieces,
        shift: clsById.get(l.class_id)?.shift ?? 1,
        weight: weightOf(pieces),
      });
    }
  }

  return units;
}

// ---------------------------------------------------------------------
// Кабинет хуваарилах
// ---------------------------------------------------------------------
function assignRooms(
  unit: Unit,
  key: string,
  ctx: {
    roomUse: Map<string, number>;
    roomById: Map<string, Room>;
    rooms: Room[];
    halls: Room[];
    teacherRooms: Record<string, string[]>;
    peSharedHall: boolean;
  }
): { rooms: (string | null)[]; priorityScore: number } | null {
  const { roomUse, roomById, rooms, halls, teacherRooms, peSharedHall } = ctx;
  const taken = new Map<string, number>(); // энэ нэгж дотор шинээр эзэлсэн

  const capacityOf = (r: Room) => (r.is_hall && peSharedHall ? 2 : 1);
  const freeSpots = (roomId: string) => {
    const r = roomById.get(roomId);
    if (!r) return 0;
    const usedNow = (roomUse.get(`${roomId}|${key}`) || 0) + (taken.get(roomId) || 0);
    return capacityOf(r) - usedNow;
  };

  const result: (string | null)[] = [];
  let priorityScore = 0;

  // Заал хуваалцсан нэгж — хоёулаа НЭГ зааланд
  if (unit.kind === "shared") {
    const hall = halls.find((h) => freeSpots(h.id) >= unit.pieces.length);
    if (!hall) return null;
    taken.set(hall.id, (taken.get(hall.id) || 0) + unit.pieces.length);
    unit.pieces.forEach(() => result.push(hall.id));
    priorityScore += 40;
    return { rooms: result, priorityScore };
  }

  for (const p of unit.pieces) {
    // Заалтай хичээл (биеийн тамир) — заалыг эрхэмлэнэ
    if (p.needsHall) {
      const hall = halls.find((h) => freeSpots(h.id) >= 1);
      if (hall) {
        taken.set(hall.id, (taken.get(hall.id) || 0) + 1);
        result.push(hall.id);
        priorityScore += 40;
        continue;
      }
    }

    // Багшийн эрэмбэлсэн кабинетууд: 1-р нь хамгийн өндөр оноотой
    const prefs = teacherRooms[p.teacherId] || [];
    let chosen: string | null = null;
    for (let i = 0; i < prefs.length && i < 7; i++) {
      if (freeSpots(prefs[i]) >= 1) {
        chosen = prefs[i];
        priorityScore += 70 - i * 10; // 70,60,50,40,30,20,10
        break;
      }
    }

    // Эрэмбэлсэн кабинет бүгд завгүй бол — сул аль нэгийг
    if (!chosen) {
      const fallback = rooms.find((r) => !r.is_hall && freeSpots(r.id) >= 1);
      if (!fallback) return null; // огт сул кабинет алга
      chosen = fallback.id;
      priorityScore -= 25; // танхим таарахгүй байгаа нь торгууль
    }

    taken.set(chosen, (taken.get(chosen) || 0) + 1);
    result.push(chosen);
  }

  return { rooms: result, priorityScore };
}

// ---------------------------------------------------------------------
// Туслах функцууд
// ---------------------------------------------------------------------
function slotKey(shift: number, day: number, period: number) {
  return `${shift}:${day}:${period}`;
}

function addTo(m: Map<string, Set<string>>, id: string, key: string) {
  if (!m.has(id)) m.set(id, new Set());
  m.get(id)!.add(key);
}

function bump(m: Map<string, number>, key: string) {
  m.set(key, (m.get(key) || 0) + 1);
}

function bumpMap(m: Map<string, number>, key: string) {
  m.set(key, (m.get(key) || 0) + 1);
}

function describeUnplaced(
  unit: Unit,
  tch: Map<string, Teacher>,
  sub: Map<string, Subject>,
  cls: Map<string, ClassRoom>,
  reason: string
): UnplacedItem {
  const p = unit.pieces[0];
  const t = tch.get(p.teacherId);
  return {
    teacherName: t ? `${t.last_name?.charAt(0) || ""}.${t.first_name}` : "?",
    subjectName: sub.get(p.subjectId)?.name || "?",
    className: unit.pieces.map((x) => cls.get(x.classId)?.name || "?").join(" + "),
    hours: unit.pieces.length,
    reason,
  };
}

/** Багшийн хуваарь дахь "цонх" (хоосон завсар) тоолох */
function countGaps(slots: PlacedSlot[], shifts: ShiftSetting[]): number {
  const byTeacherDay = new Map<string, number[]>();
  for (const s of slots) {
    const k = `${s.teacher_id}|${s.shift}|${s.day_of_week}`;
    if (!byTeacherDay.has(k)) byTeacherDay.set(k, []);
    byTeacherDay.get(k)!.push(s.period);
  }
  let gaps = 0;
  for (const [, periods] of byTeacherDay) {
    const uniq = [...new Set(periods)].sort((a, b) => a - b);
    if (uniq.length < 2) continue;
    for (let i = 1; i < uniq.length; i++) gaps += uniq[i] - uniq[i - 1] - 1;
  }
  return gaps;
}

// ---------------------------------------------------------------------
// БЭЛЭН ХУВААРИЙГ ШАЛГАХ (зөрчил илрүүлэх)
// ---------------------------------------------------------------------
export interface Conflict {
  type: "teacher" | "class" | "room" | "hours";
  message: string;
  day?: number;
  period?: number;
}

export function validateSchedule(
  slots: (PlacedSlot | ScheduleSlot)[],
  ctx: {
    teachers: Teacher[];
    classes: ClassRoom[];
    rooms: Room[];
    subjects: Subject[];
    loads: TeachingLoad[];
    peSharedHall: boolean;
  }
): Conflict[] {
  const out: Conflict[] = [];
  const tName = new Map(
    ctx.teachers.map((t) => [t.id, `${t.last_name?.charAt(0) || ""}.${t.first_name}`])
  );
  const cName = new Map(ctx.classes.map((c) => [c.id, c.name]));
  const rName = new Map(ctx.rooms.map((r) => [r.id, r.name]));
  const rHall = new Map(ctx.rooms.map((r) => [r.id, r.is_hall]));

  const tMap = new Map<string, (PlacedSlot | ScheduleSlot)[]>();
  const cMap = new Map<string, (PlacedSlot | ScheduleSlot)[]>();
  const rMap = new Map<string, (PlacedSlot | ScheduleSlot)[]>();

  for (const s of slots) {
    const k = `${s.shift}:${s.day_of_week}:${s.period}`;
    push(tMap, `${s.teacher_id}|${k}`, s);
    push(cMap, `${s.class_id}|${k}|${s.subgroup || "-"}`, s);
    if (s.room_id) push(rMap, `${s.room_id}|${k}`, s);
  }

  for (const [k, arr] of tMap) {
    if (arr.length > 1) {
      const [id] = k.split("|");
      out.push({
        type: "teacher",
        message: `${tName.get(id) || id} багш ${arr[0].day_of_week}-р өдрийн ${arr[0].period}-р цагт ${arr.length} ангид давхардаж байна`,
        day: arr[0].day_of_week,
        period: arr[0].period,
      });
    }
  }

  for (const [k, arr] of cMap) {
    if (arr.length > 1) {
      const [id] = k.split("|");
      out.push({
        type: "class",
        message: `${cName.get(id) || id} анги ${arr[0].day_of_week}-р өдрийн ${arr[0].period}-р цагт ${arr.length} хичээлтэй давхардаж байна`,
        day: arr[0].day_of_week,
        period: arr[0].period,
      });
    }
  }

  for (const [k, arr] of rMap) {
    const [id] = k.split("|");
    const cap = rHall.get(id) && ctx.peSharedHall ? 2 : 1;
    // нэг зааланд нэг л хичээл (shared unit) байвал зөрчил биш
    const distinctClasses = new Set(arr.map((a) => a.class_id)).size;
    if (distinctClasses > cap) {
      out.push({
        type: "room",
        message: `${rName.get(id) || id} кабинет ${arr[0].day_of_week}-р өдрийн ${arr[0].period}-р цагт ${distinctClasses} ангиар дүүрч байна`,
        day: arr[0].day_of_week,
        period: arr[0].period,
      });
    }
  }

  // Цагийн тоо тулгах
  const need = new Map<string, number>();
  for (const l of ctx.loads) {
    const k = `${l.teacher_id}|${l.subject_id}|${l.class_id}`;
    need.set(k, (need.get(k) || 0) + Number(l.hours_per_week));
  }
  const got = new Map<string, number>();
  for (const s of slots) {
    const k = `${s.teacher_id}|${s.subject_id}|${s.class_id}`;
    got.set(k, (got.get(k) || 0) + 1);
  }
  const subjName = new Map(ctx.subjects.map((s) => [s.id, s.name]));
  for (const [k, n] of need) {
    const g = got.get(k) || 0;
    const rounded = Math.round(n);
    if (g !== rounded) {
      const [tid, sid, cid] = k.split("|");
      out.push({
        type: "hours",
        message: `${tName.get(tid) || "?"} — ${subjName.get(sid) || "?"} — ${cName.get(cid) || "?"}: шаардлагатай ${rounded} цаг, хуваарилсан ${g} цаг`,
      });
    }
  }

  return out;
}

function push<T>(m: Map<string, T[]>, k: string, v: T) {
  if (!m.has(k)) m.set(k, []);
  m.get(k)!.push(v);
}

// ---------------------------------------------------------------------
// Хичээлийн цагийн хуваарь (эхлэх/дуусах цаг) тооцоолох
// ---------------------------------------------------------------------
export function periodTimes(st: ShiftSetting): { period: number; start: string; end: string }[] {
  const out: { period: number; start: string; end: string }[] = [];
  const [h, m] = (st.start_time || "08:00").split(":").map(Number);
  let cur = h * 60 + (m || 0);

  for (let p = 1; p <= st.periods_per_day; p++) {
    const start = cur;
    const end = start + st.lesson_minutes;
    out.push({ period: p, start: fmt(start), end: fmt(end) });
    cur = end;
    if (st.long_break_after && p === st.long_break_after) {
      cur += st.long_break_minutes || st.break_minutes;
    } else {
      cur += st.break_minutes;
    }
  }
  return out;
}

function fmt(mins: number) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
