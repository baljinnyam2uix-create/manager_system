export type UserRole = "admin" | "manager";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type TeacherRank = "Байхгүй" | "Заах аргач" | "Тэргүүлэх" | "Зөвлөх";
export type PlanPeriod = "year" | "quarter" | "month" | "week";
export type PlanStatus = "planned" | "in_progress" | "done" | "cancelled";

export interface Profile {
  id: string;
  email: string;
  last_name: string | null;
  first_name: string | null;
  phone: string | null;
  position: string | null;
  role: UserRole;
  status: ApprovalStatus;
  school_id: string | null;
  school_name: string | null;
  approved_at: string | null;
  reject_reason: string | null;
  created_at: string;
}

export interface Subject {
  id: string;
  owner_id: string;
  name: string;
  department: string | null;
  color: string;
  is_elective: boolean;
  is_subgroup: boolean;
  subgroup_kind: string | null;
  allow_shared_room: boolean;
}

export interface ClassRoom {
  id: string;
  owner_id: string;
  name: string;
  grade: number;
  section: string | null;
  shift: number;
  student_count: number | null;
  homeroom_teacher_id: string | null;
}

export interface Room {
  id: string;
  owner_id: string;
  name: string;
  capacity: number | null;
  is_hall: boolean;
  building: string | null;
}

export interface Teacher {
  id: string;
  owner_id: string;
  last_name: string;
  first_name: string;
  register_no: string | null;
  phone: string | null;
  email: string | null;
  home_address: string | null;
  birth_date: string | null;
  hire_date: string | null;
  years_worked: number | null;
  rank: TeacherRank;
  department: string | null;
  main_room_id: string | null;
  is_homeroom: boolean;
  homeroom_class_id: string | null;
  base_salary: number | null;
  hourly_rate: number | null;
  active: boolean;
  note: string | null;
}

export interface TeacherRoom {
  id: string;
  teacher_id: string;
  room_id: string;
  priority: number;
}

export interface TeachingLoad {
  id: string;
  owner_id: string;
  teacher_id: string;
  subject_id: string;
  class_id: string;
  hours_per_week: number;
  is_elective: boolean;
  subgroup: string | null;
}

export interface ShiftSetting {
  id: string;
  owner_id: string;
  shift: number;
  name: string;
  start_time: string;
  lesson_minutes: number;
  break_minutes: number;
  long_break_after: number | null;
  long_break_minutes: number | null;
  periods_per_day: number;
  days_per_week: number;
  active: boolean;
}

export interface ScheduleVersion {
  id: string;
  owner_id: string;
  name: string;
  school_year: string;
  semester: number;
  is_active: boolean;
  pe_shared_hall: boolean;
  notes: string | null;
  created_at: string;
}

export interface ScheduleSlot {
  id: string;
  owner_id: string;
  version_id: string;
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

export interface Plan {
  id: string;
  owner_id: string;
  period: PlanPeriod;
  school_year: string;
  quarter: number | null;
  month: number | null;
  week: number | null;
  title: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface PlanItem {
  id: string;
  owner_id: string;
  plan_id: string;
  seq: number;
  activity: string;
  responsible: string | null;
  due_date: string | null;
  indicator: string | null;
  budget: number | null;
  status: PlanStatus;
  progress: number;
  note: string | null;
}

export interface PerformanceTask {
  id: string;
  owner_id: string;
  period_id: string | null;
  teacher_id: string;
  plan_item_id: string | null;
  title: string;
  category: string | null;
  due_date: string | null;
  is_done: boolean;
  done_at: string | null;
  score: number | null;
  max_score: number | null;
  comment: string | null;
}

export interface PayrollSettings {
  id: string;
  owner_id: string;
  school_year: string;
  overtime_multiplier: number;
  homeroom_bonus: number;
  room_bonus: number;
  zan_bonus: number;
  skill_bonus_pct: number;
  rank_bonus_argach: number;
  rank_bonus_terguuleh: number;
  rank_bonus_zovloh: number;
  ndsh_pct: number;
  hhoat_pct: number;
  hhoat_deduction: number;
}

export interface PayrollMonth {
  id: string;
  owner_id: string;
  teacher_id: string;
  school_year: string;
  month: number;
  month_label: string | null;
  work_days: number;
  work_hours: number;
  actual_days: number;
  actual_hours: number;
  sha_program_hours: number;
  sha_improve_hours: number;
  sha_other_hours: number;
  sha_teach_hours: number;
  taught_hours: number;
  substitute_hours: number;
  overtime_hours: number;
  bonus_homeroom: number;
  bonus_room: number;
  bonus_zan: number;
  bonus_skill: number;
  bonus_rank: number;
  vacation_amount: number;
  deduction_other: number;
  note: string | null;
}

export interface Observation {
  id: string;
  owner_id: string;
  teacher_id: string;
  class_id: string | null;
  subject_id: string | null;
  observed_date: string;
  period: number | null;
  start_time: string | null;
  topic: string | null;
  note: string | null;
  strengths: string | null;
  suggestions: string | null;
  score: number | null;
  observer: string | null;
}

export interface Student {
  id: string;
  owner_id: string;
  class_id: string;
  last_name: string | null;
  first_name: string;
  student_no: string | null;
  gender: string | null;
  active: boolean;
}

export interface Grade {
  id: string;
  owner_id: string;
  student_id: string;
  subject_id: string;
  school_year: string;
  quarter: number;
  score: number | null;
  letter: string | null;
  note: string | null;
}

// ------------------------------------------------------------------
// Тогтмолууд
// ------------------------------------------------------------------

export const DAYS = ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
export const DAYS_SHORT = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя"];
export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
export const MONTH_ORDER = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
export const MONTH_ROMAN: Record<number, string> = {
  1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI",
  7: "VII", 8: "VIII", 9: "IX", 10: "X", 11: "XI", 12: "XII",
};
export const MONTH_NAMES_MN: Record<number, string> = {
  1: "1-р сар", 2: "2-р сар", 3: "3-р сар", 4: "4-р сар", 5: "5-р сар", 6: "6-р сар",
  7: "7-р сар", 8: "8-р сар", 9: "9-р сар", 10: "10-р сар", 11: "11-р сар", 12: "12-р сар",
};
export const RANKS: TeacherRank[] = ["Байхгүй", "Заах аргач", "Тэргүүлэх", "Зөвлөх"];

export const PLAN_PERIOD_LABEL: Record<PlanPeriod, string> = {
  year: "Жилийн",
  quarter: "Улирлын",
  month: "Сарын",
  week: "7 хоногийн",
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  planned: "Төлөвлөсөн",
  in_progress: "Хэрэгжиж буй",
  done: "Дууссан",
  cancelled: "Цуцалсан",
};

export function teacherName(t: { last_name?: string | null; first_name?: string | null } | null | undefined) {
  if (!t) return "";
  const ln = (t.last_name || "").trim();
  const fn = (t.first_name || "").trim();
  return ln ? `${ln.charAt(0).toUpperCase()}.${fn}` : fn;
}

export function fullName(t: { last_name?: string | null; first_name?: string | null } | null | undefined) {
  if (!t) return "";
  return [t.last_name, t.first_name].filter(Boolean).join(" ");
}

export function money(n: number | null | undefined) {
  const v = Number(n || 0);
  return v.toLocaleString("mn-MN", { maximumFractionDigits: 0 }) + "₮";
}
