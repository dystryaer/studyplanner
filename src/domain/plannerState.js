import { getStartOfWeek, getWeekKey } from "../utils/calendar.js";
import { findCategory, getTaskCategories } from "../utils/plannerSelectors.js";

export const PLANNER_STATE_VERSION = 2;

export function createInitialPlannerState() {
  return {
    version: PLANNER_STATE_VERSION,
    tasks: [],
    dailyTasks: [],
    events: [],
    updatedAt: null,
    dailyTasksResetAt: null,
    weeklyCleanupWeekKey: null,
    userSettings: { theme: null, categories: [] },
  };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function records(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(item => !isRecord(item))) throw new Error("Planner records must be an array of objects");
  return value;
}

function stringOrNull(value) {
  return typeof value === "string" ? value : null;
}

function isoOrNull(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
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

function normalizeTask(task, categories) {
  const bucket = task.bucket === "week" && typeof task.weekKey === "string" ? "week" : "backlog";
  return {
    ...task,
    title: typeof task.title === "string" ? task.title : "",
    categoryId: resolveCategoryId(task, categories),
    status: task.status === "done" ? "done" : "planned",
    bucket,
    weekKey: bucket === "week" ? task.weekKey : null,
    due: stringOrNull(task.due),
  };
}

function normalizeDailyTask(task, categories) {
  return {
    ...task,
    title: typeof task.title === "string" ? task.title : "",
    categoryId: resolveCategoryId(task, categories),
    status: task.status === "done" ? "done" : "planned",
    bucket: "daily",
  };
}

function normalizeEvent(event) {
  if (typeof event.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) throw new Error("Planner event has an invalid date");
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
  if (version !== 1 && version !== PLANNER_STATE_VERSION) {
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
    weeklyCleanupWeekKey: legacy ? null : stringOrNull(raw.weeklyCleanupWeekKey),
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
  let next = state;

  const weekKey = getWeekKey(now);
  if (state.weeklyCleanupWeekKey !== weekKey) {
    const tasks = state.tasks.map((task) =>
      task.bucket === "week" && task.status !== "done" && task.weekKey < weekKey
        ? { ...task, bucket: "backlog", weekKey: null, status: "planned" }
        : task
    );
    next = { ...next, tasks, weeklyCleanupWeekKey: weekKey };
  }

  const boundary = getDailyResetBoundary(now);
  const lastReset = state.dailyTasksResetAt === null ? null : new Date(state.dailyTasksResetAt);
  if (lastReset === null || lastReset < boundary) {
    const dailyTasks = next.dailyTasks.map((task) =>
      task.status === "planned" ? task : { ...task, status: "planned" }
    );
    next = { ...next, dailyTasks, dailyTasksResetAt: boundary.toISOString() };
  }

  return next;
}
