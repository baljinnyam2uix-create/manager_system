/**
 * ЦАЛИНГИЙН ТООЦОО
 * "Цагийн тооцооны хуудас" Excel файлын бүтцийг дагаж боловсруулав.
 */

import type { PayrollMonth, PayrollSettings, Teacher } from "./types";

export interface PayrollResult {
  /** Хичээл заасан цагийн хөлс */
  teachingPay: number;
  /** Орлон заасан цагийн хөлс */
  substitutePay: number;
  /** Илүү цагийн хөлс (коэффициенттэй) */
  overtimePay: number;
  /** СХА — хөтөлбөрийн ажлын цагийн хөлс */
  shaPay: number;
  /** Нэмэгдэл хөлсний нийлбэр */
  bonusTotal: number;
  bonusBreakdown: {
    homeroom: number;
    room: number;
    zan: number;
    skill: number;
    rank: number;
  };
  /** Нийт цалин (татварын өмнөх) */
  gross: number;
  /** НДШ */
  ndsh: number;
  /** ХХОАТ */
  hhoat: number;
  /** Бусад суутгал */
  otherDeduction: number;
  /** Гарт олгох */
  net: number;
  /** Тайлбар мөрүүд */
  lines: { label: string; value: number; kind: "add" | "sub" | "info" }[];
}

export function rankBonus(t: Teacher, s: PayrollSettings): number {
  switch (t.rank) {
    case "Заах аргач":
      return Number(s.rank_bonus_argach || 0);
    case "Тэргүүлэх":
      return Number(s.rank_bonus_terguuleh || 0);
    case "Зөвлөх":
      return Number(s.rank_bonus_zovloh || 0);
    default:
      return 0;
  }
}

export function calcPayroll(
  m: Partial<PayrollMonth>,
  t: Teacher,
  s: PayrollSettings
): PayrollResult {
  const rate = Number(t.hourly_rate || 0);

  const taught = Number(m.taught_hours || 0);
  const sub = Number(m.substitute_hours || 0);
  const over = Number(m.overtime_hours || 0);
  const sha =
    Number(m.sha_program_hours || 0) +
    Number(m.sha_improve_hours || 0) +
    Number(m.sha_other_hours || 0);

  const teachingPay = taught * rate;
  const substitutePay = sub * rate;
  const overtimePay = over * rate * Number(s.overtime_multiplier || 1.5);
  const shaPay = sha * rate;

  // Нэмэгдэл хөлс — гараар оруулсан утга байвал түүнийг, үгүй бол тохиргооноос
  const bHomeroom =
    m.bonus_homeroom != null
      ? Number(m.bonus_homeroom)
      : t.is_homeroom
        ? Number(s.homeroom_bonus || 0)
        : 0;
  const bRoom =
    m.bonus_room != null
      ? Number(m.bonus_room)
      : t.main_room_id
        ? Number(s.room_bonus || 0)
        : 0;
  const bZan = m.bonus_zan != null ? Number(m.bonus_zan) : 0;
  const bRank = m.bonus_rank != null ? Number(m.bonus_rank) : rankBonus(t, s);

  const baseForSkill = teachingPay + substitutePay + Number(t.base_salary || 0);
  const bSkill =
    m.bonus_skill != null
      ? Number(m.bonus_skill)
      : (baseForSkill * Number(s.skill_bonus_pct || 0)) / 100;

  const bonusBreakdown = {
    homeroom: bHomeroom,
    room: bRoom,
    zan: bZan,
    skill: bSkill,
    rank: bRank,
  };
  const bonusTotal = bHomeroom + bRoom + bZan + bSkill + bRank;

  const vacation = Number(m.vacation_amount || 0);
  const gross =
    Number(t.base_salary || 0) +
    teachingPay +
    substitutePay +
    overtimePay +
    shaPay +
    bonusTotal +
    vacation;

  const ndsh = (gross * Number(s.ndsh_pct || 0)) / 100;
  const taxable = Math.max(0, gross - ndsh);
  const hhoatRaw = (taxable * Number(s.hhoat_pct || 0)) / 100;
  const hhoat = Math.max(0, hhoatRaw - Number(s.hhoat_deduction || 0));
  const otherDeduction = Number(m.deduction_other || 0);

  const net = gross - ndsh - hhoat - otherDeduction;

  const lines: PayrollResult["lines"] = [
    { label: "Үндсэн цалин", value: Number(t.base_salary || 0), kind: "add" },
    { label: `Хичээл заасан цаг (${taught} ц × ${rate.toLocaleString()}₮)`, value: teachingPay, kind: "add" },
    { label: `Орлон заасан цаг (${sub} ц)`, value: substitutePay, kind: "add" },
    { label: `Илүү цаг (${over} ц × ${s.overtime_multiplier})`, value: overtimePay, kind: "add" },
    { label: `СХА — хөтөлбөрийн ажил (${sha} ц)`, value: shaPay, kind: "add" },
    { label: "Анги даалт", value: bHomeroom, kind: "add" },
    { label: "Кабинет", value: bRoom, kind: "add" },
    { label: "ЗАН", value: bZan, kind: "add" },
    { label: `Ур чадвар (${s.skill_bonus_pct}%)`, value: bSkill, kind: "add" },
    { label: `Зэрэг (${t.rank})`, value: bRank, kind: "add" },
    { label: "Амралтын олговор", value: vacation, kind: "add" },
    { label: "НИЙТ ЦАЛИН", value: gross, kind: "info" },
    { label: `НДШ (${s.ndsh_pct}%)`, value: ndsh, kind: "sub" },
    { label: `ХХОАТ (${s.hhoat_pct}%, хөнгөлөлт ${Number(s.hhoat_deduction).toLocaleString()}₮)`, value: hhoat, kind: "sub" },
    { label: "Бусад суутгал", value: otherDeduction, kind: "sub" },
    { label: "ГАРТ ОЛГОХ", value: net, kind: "info" },
  ];

  return {
    teachingPay,
    substitutePay,
    overtimePay,
    shaPay,
    bonusTotal,
    bonusBreakdown,
    gross,
    ndsh,
    hhoat,
    otherDeduction,
    net,
    lines,
  };
}

/** Хуваариас сарын цагийг автоматаар тооцох (7 хоногийн цаг × долоо хоногийн тоо) */
export function estimateMonthlyHours(weeklyHours: number, weeksInMonth = 4.3) {
  return Math.round(weeklyHours * weeksInMonth * 10) / 10;
}

/** Тухайн сард хэдэн ажлын өдөр байгааг тооцох (Бя, Ня амарна) */
export function workDaysInMonth(year: number, month: number, daysPerWeek = 5) {
  const last = new Date(year, month, 0).getDate();
  let n = 0;
  for (let d = 1; d <= last; d++) {
    const wd = new Date(year, month - 1, d).getDay(); // 0=Ням
    if (daysPerWeek >= 6 ? wd !== 0 : wd !== 0 && wd !== 6) n++;
  }
  return n;
}
