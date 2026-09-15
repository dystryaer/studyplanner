const WEEK_MS = 7 * 86400000;

function mondayOffset(date) {
  return (date.getDay() + 6) % 7;
}

export function getStartOfWeek(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - mondayOffset(start));
  return start;
}

export function getIsoWeek(date) {
  const thursday = new Date(date);
  thursday.setHours(0, 0, 0, 0);
  thursday.setDate(thursday.getDate() + 3 - mondayOffset(thursday));

  const year = thursday.getFullYear();
  const firstThursday = new Date(year, 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - mondayOffset(firstThursday));

  return { year, week: 1 + Math.round((thursday - firstThursday) / WEEK_MS) };
}

export function getWeekKey(date) {
  const { year, week } = getIsoWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function parseWeekKey(weekKey) {
  const match = /^(\d{4})-W(\d{2})$/.exec(String(weekKey));
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const lastWeek = getIsoWeek(new Date(year, 11, 28)).week;
  return week >= 1 && week <= lastWeek ? { year, week } : null;
}

export function getMondayOfWeekKey(weekKey) {
  const parsed = parseWeekKey(weekKey);
  if (!parsed) return null;
  const jan4 = new Date(parsed.year, 0, 4);
  const monday = getStartOfWeek(jan4);
  monday.setDate(monday.getDate() + (parsed.week - 1) * 7);
  return monday;
}

export function shiftWeekKey(weekKey, delta) {
  const monday = getMondayOfWeekKey(weekKey);
  if (!monday) return null;
  monday.setDate(monday.getDate() + delta * 7);
  return getWeekKey(monday);
}

export function getWeekDays(startDate) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setHours(0, 0, 0, 0);
    date.setDate(startDate.getDate() + index);
    return date;
  });
}

export function buildCalendarDays(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - mondayOffset(firstOfMonth));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return { date, isCurrentMonth: date.getMonth() === month };
  });
}
