import { parseLocalDate, toDateKey, getDueState } from "./date.js";
import { getWeekDays } from "./calendar.js";
import { defaultEventCategories, defaultTaskCategories } from "../data/defaultCategories.js";

function byOrder(a, b) {
  return (a.order ?? 0) - (b.order ?? 0);
}

function byDue(a, b) {
  return String(a.due).localeCompare(String(b.due)) || byOrder(a, b);
}

function bySlotTime(a, b) {
  const timeA = a.plannedSlot?.startTime || a.startTime || "";
  const timeB = b.plannedSlot?.startTime || b.startTime || "";
  if (timeA !== timeB) {
    if (!timeA) return -1;
    if (!timeB) return 1;
    return timeA.localeCompare(timeB);
  }
  return byOrder(a, b);
}

export function taskMembershipKey(task) {
  if (task.bucket === "daily") return "daily";
  if (task.bucket === "backlog") return `backlog:${task.status}:${task.categoryId ?? ""}`;
  return `week:${task.weekKey}:${task.status}:${task.categoryId ?? ""}`;
}

export function getTaskContainer(task, weekKey) {
  if (task.bucket === "daily") return "daily";
  if (task.bucket === "backlog") return "backlog";
  if (task.bucket === "week" && task.weekKey === weekKey) {
    return task.status === "done" ? "week-done" : "week";
  }
  return null;
}

export function getTasksByContainer(tasks, dailyTasks, container, weekKey) {
  const source = container === "daily" ? dailyTasks ?? [] : tasks ?? [];
  return source
    .filter((task) => getTaskContainer(task, weekKey) === container)
    .sort(byOrder);
}

export function getBacklogTasks(tasks = []) {
  return getTasksByContainer(tasks, [], "backlog", null);
}

export function getWeekTasks(tasks, activeWeekKey) {
  return tasks
    .filter((task) => task.bucket === "week" && task.weekKey === activeWeekKey)
    .sort(byOrder);
}

export function getTaskCategories(userSettings) {
  const saved = (userSettings?.categories ?? []).filter((cat) => cat.kind === "task");
  return saved.length > 0 ? saved : defaultTaskCategories;
}

export function getEventCategories(userSettings) {
  const saved = (userSettings?.categories ?? []).filter((cat) => cat.kind === "event");
  return saved.length > 0 ? saved : defaultEventCategories;
}

export function findCategory(categories, record) {
  return (
    categories.find((cat) => cat.id === record.categoryId) ??
    categories.find((cat) => cat.label === record.subject) ??
    null
  );
}

export function getSelectedDateEvents(events, selectedDateKey) {
  return events
    .filter((event) => event.date === selectedDateKey)
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

export function getWeekEvents(events, weekRange) {
  return events.filter((event) => {
    const eventDate = parseLocalDate(event.date);
    return eventDate >= weekRange.start && eventDate <= weekRange.end;
  });
}

export function getEventDates(events) {
  return new Set(events.map((event) => event.date));
}

export function countTasksByStatus(tasks, status) {
  return tasks.filter((task) => task.status === status).length;
}

export function getWeekCategoryGroups(tasks, categories, weekKey, { categoryId = null, dueMode = "all" } = {}, now = new Date()) {
  const source = dueMode === "overdue" ? getOverdueTasks(tasks, now)
    : dueMode === "upcoming" ? getUpcomingTasks(tasks, now)
    : getWeekTasks(tasks, weekKey);
  const weekTasks = source.filter((task) => !categoryId || task.categoryId === categoryId);
  const sort = dueMode === "all" ? byOrder : byDue;
  const byCategory = new Map();
  for (const task of weekTasks) {
    const key = task.categoryId ?? "";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(task);
  }
  const knownIds = new Set(categories.map((category) => category.id));
  const groups = [];
  for (const category of categories) {
    const items = byCategory.get(category.id);
    if (!items) continue;
    groups.push({
      category,
      planned: items.filter((task) => task.status !== "done").sort(sort),
      done: items.filter((task) => task.status === "done").sort(byOrder),
    });
  }
  for (const [key, items] of byCategory) {
    if (knownIds.has(key)) continue;
    groups.push({
      category: { id: key || "uncategorized", label: items[0]?.subject ?? "Other", baseColor: "#ffda96" },
      planned: items.filter((task) => task.status !== "done").sort(sort),
      done: items.filter((task) => task.status === "done").sort(byOrder),
    });
  }
  return groups;
}

export function getReviewTasks(tasks = [], currentWeekKey) {
  return tasks
    .filter((task) => task.bucket === "week" && task.status !== "done" && typeof task.weekKey === "string" && task.weekKey < currentWeekKey)
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey) || byOrder(a, b));
}

export function getAgendaDays(events = [], tasks = [], weekRange) {
  return getWeekDays(weekRange.start).map((date) => {
    const dateKey = toDateKey(date);
    return {
      date,
      dateKey,
      events: getSelectedDateEvents(events, dateKey),
      tasks: tasks
        .filter((task) => task.bucket === "week" && task.plannedSlot?.date === dateKey)
        .sort(bySlotTime),
    };
  });
}

export function getOverdueTasks(tasks = [], now = new Date()) {
  return tasks.filter((task) => task.status !== "done" && getDueState(task.due, now) === "overdue").sort(byDue);
}

export function getUpcomingTasks(tasks = [], now = new Date()) {
  return tasks.filter((task) => task.status !== "done" && task.due && getDueState(task.due, now) !== "overdue").sort(byDue);
}
