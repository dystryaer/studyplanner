import { parseLocalDate } from "./date.js";
import { defaultEventCategories, defaultTaskCategories } from "../data/defaultCategories.js";

function byOrder(a, b) {
  return (a.order ?? 0) - (b.order ?? 0);
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
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
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
