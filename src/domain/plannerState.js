import { getStartOfWeek, getWeekKey, getMondayOfWeekKey } from "../utils/calendar.js";
import { parseLocalDate, toDateKey } from "../utils/date.js";
import { findCategory, getTaskCategories } from "../utils/plannerSelectors.js";

export const PLANNER_STATE_VERSION = 3;
const SUPPORTED_VERSIONS = new Set([1, 2, 3]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export function createInitialPlannerState() {
  return {
    version: PLANNER_STATE_VERSION,
    tasks: [],
    dailyTasks: [],
    events: [],
    updatedAt: null,
    dailyTasksResetAt: null,
    userSettings: { theme: null, categories: [] },
  };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function records(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) throw new Error("Planner records must be an array of objects");
  return value;
}

function stringOrNull(value) {
  return typeof value === "string" && value !== "" ? value : null;
}

function isoOrNull(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

export function normalizeClockTime(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") throw new Error("Planner time must be a string");
  const match = TIME_RE.exec(value);
  if (!match) throw new Error("Planner time is invalid");
  return `${match[1]}:${match[2]}`;
}

function isDate(value) {
  return typeof value === "string" && DATE_RE.test(value) && toDateKey(parseLocalDate(value)) === value;
}

export function createPlannedSlot({ date, startTime = "", endTime = "" }) {
  if (!isDate(date)) throw new Error("Planner slot has an invalid date");
  const start = normalizeClockTime(startTime);
  const end = normalizeClockTime(endTime);
  if (end && !start) throw new Error("An end time requires a start time");
  if (start && end && end <= start) throw new Error("End time must be after start time");
  return { date, startTime: start, endTime: end };
}

export function parseTaskDestination(dest) {
  if (!isRecord(dest)) throw new Error("Task destination must be an object");
  if (dest.kind === "backlog") return { kind: "backlog" };
  if (dest.kind === "week") {
    if (!getMondayOfWeekKey(dest.weekKey)) {
      throw new Error("Week destination has an invalid week key");
    }
    return { kind: "week", weekKey: dest.weekKey };
  }
  if (dest.kind === "day") {
    if (!isDate(dest.date)) {
      throw new Error("Day destination has an invalid date");
    }
    const parsed = { kind: "day", date: dest.date };
    if (dest.startTime !== undefined || dest.endTime !== undefined) {
      const slot = createPlannedSlot({
        date: dest.date,
        startTime: dest.startTime ?? "",
        endTime: dest.endTime ?? "",
      });
      parsed.startTime = slot.startTime;
      parsed.endTime = slot.endTime;
    }
    return parsed;
  }
  throw new Error(`Unknown task destination ${String(dest.kind)}`);
}

export function applyTaskDestination(task, dest) {
  if (dest.kind === "backlog") {
    return { ...task, bucket: "backlog", weekKey: null, plannedSlot: null };
  }
  if (dest.kind === "week") {
    return { ...task, bucket: "week", weekKey: dest.weekKey, plannedSlot: null };
  }
  const startTime = dest.startTime === undefined ? (task.plannedSlot?.startTime ?? "") : dest.startTime;
  const endTime = dest.endTime === undefined ? (task.plannedSlot?.endTime ?? "") : dest.endTime;
  const plannedSlot = createPlannedSlot({ date: dest.date, startTime, endTime });
  return {
    ...task,
    bucket: "week",
    weekKey: getWeekKey(parseLocalDate(plannedSlot.date)),
    plannedSlot,
  };
}

function legacyWeekKey(date) {
  const start = getStartOfWeek(date);
  const firstThursday = new Date(start);
  firstThursday.setDate(start.getDate() + 3);
  const firstJan = new Date(firstThursday.getFullYear(), 0, 1);
  const days = Math.floor((firstThursday - firstJan) / 86400000);
  const week = Math.ceil((days + firstJan.getDay() + 1) / 7);
  return `${start.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function migrateLegacyWeekKey(key) {
  const match = /^(\d{4})-W(\d{2})$/.exec(String(key));
  if (!match) return null;
  const year = Number(match[1]);
  const matches = [];
  const monday = getStartOfWeek(new Date(year, 0, 7));
  for (; monday.getFullYear() === year; monday.setDate(monday.getDate() + 7)) {
    if (legacyWeekKey(monday) === key) matches.push(new Date(monday));
  }
  return matches.length === 1 ? getWeekKey(matches[0]) : null;
}

function migrateLegacyTask(task) {
  if (task.bucket !== "week") return task;
  const weekKey = migrateLegacyWeekKey(task.weekKey);
  if (weekKey) return { ...task, weekKey };
  return { ...task, bucket: "backlog", weekKey: null, legacyWeekKey: task.weekKey ?? null };
}

function resolveCategoryId(record, categories) {
  if (typeof record.categoryId === "string") return record.categoryId;
  return findCategory(categories, record)?.id ?? null;
}

function normalizePlannedSlot(task) {
  if (task.plannedSlot == null) return null;
  if (task.bucket !== "week") throw new Error("A planned slot requires a week task");
  const slot = createPlannedSlot(task.plannedSlot);
  if (getWeekKey(parseLocalDate(slot.date)) !== task.weekKey) {
    throw new Error("A planned slot must fall in the task week");
  }
  return slot;
}

function normalizeTask(task, categories) {
  const bucket = task.bucket === "week" && typeof task.weekKey === "string" ? "week" : "backlog";
  const normalized = {
    ...task,
    title: typeof task.title === "string" ? task.title : "",
    categoryId: resolveCategoryId(task, categories),
    status: task.status === "done" ? "done" : "planned",
    bucket,
    weekKey: bucket === "week" ? task.weekKey : null,
    due: stringOrNull(task.due),
  };
  if (task.plannedSlot != null && bucket !== "week") throw new Error("A planned slot requires a week task");
  normalized.plannedSlot = bucket === "week" ? normalizePlannedSlot({ ...task, ...normalized }) : null;
  return normalized;
}

function normalizeDailyTask(task, categories) {
  const status = task.status === "done" || task.status === "skipped" ? task.status : "planned";
  return {
    ...task,
    title: typeof task.title === "string" ? task.title : "",
    categoryId: resolveCategoryId(task, categories),
    status,
    paused: task.paused === true,
    bucket: "daily",
  };
}

function normalizeEvent(event) {
  if (typeof event.date !== "string" || !DATE_RE.test(event.date)) throw new Error("Planner event has an invalid date");
  return {
    ...event,
    title: typeof event.title === "string" ? event.title : "",
    categoryId: stringOrNull(event.categoryId) ?? stringOrNull(event.category),
    date: stringOrNull(event.date),
    startTime: typeof event.startTime === "string" ? event.startTime : "",
    endTime: typeof event.endTime === "string" ? event.endTime : "",
  };
}

function normalizeSettings(value) {
  const theme = value?.theme === "light" || value?.theme === "dark" ? value.theme : null;
  const categories = records(value?.categories).map((cat) => ({
    ...cat,
    label: typeof cat.label === "string" ? cat.label : "",
  }));
  return { theme, categories };
}

export function parsePlannerState(raw) {
  if (!isRecord(raw)) throw new Error("Planner state must be an object");
  const version = raw.version === undefined ? 1 : raw.version;
  if (!SUPPORTED_VERSIONS.has(version)) {
    throw new Error(`Unsupported planner state version ${String(version)}`);
  }
  const legacy = version === 1;
  const userSettings = normalizeSettings(raw.userSettings);
  const categories = getTaskCategories(userSettings);
  const tasks = records(raw.tasks)
    .map((task) => (legacy ? migrateLegacyTask(task) : task))
    .map((task) => normalizeTask(task, categories));

  return {
    version: PLANNER_STATE_VERSION,
    tasks,
    dailyTasks: records(raw.dailyTasks).map((task) => normalizeDailyTask(task, categories)),
    events: records(raw.events).map(normalizeEvent),
    updatedAt: isoOrNull(raw.updatedAt),
    dailyTasksResetAt: isoOrNull(raw.dailyTasksResetAt),
    userSettings,
  };
}

export function getDailyResetBoundary(now) {
  const boundary = new Date(now);
  boundary.setHours(4, 0, 0, 0);
  if (boundary > now) boundary.setDate(boundary.getDate() - 1);
  return boundary;
}

export function applyTimeRules(state, now) {
  const boundary = getDailyResetBoundary(now);
  const lastReset = state.dailyTasksResetAt === null ? null : new Date(state.dailyTasksResetAt);
  if (lastReset !== null && lastReset >= boundary) return state;

  const dailyTasks = state.dailyTasks.map((task) =>
    task.status === "planned" ? task : { ...task, status: "planned" }
  );
  return { ...state, dailyTasks, dailyTasksResetAt: boundary.toISOString() };
}
