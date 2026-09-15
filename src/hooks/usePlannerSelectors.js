import { useMemo } from "react";
import { formatDate, toDateKey } from "../utils/date";
import { buildCalendarDays, getStartOfWeek, getWeekKey, shiftWeekKey } from "../utils/calendar";
import {
  getAgendaDays,
  getBacklogTasks,
  getEventDates,
  getReviewTasks,
  getSelectedDateEvents,
  getWeekEvents,
  getWeekTasks,
  getTasksByContainer,
} from "../utils/plannerSelectors";
import { defaultTaskCategories, defaultEventCategories } from "../data/defaultCategories";

export function usePlannerSelectors({ data, weekOffset, calendarDate, selectedDate, today }) {
  const activeWeekDate = useMemo(() => {
    const base = new Date(today);
    base.setDate(base.getDate() + weekOffset * 7);
    return getStartOfWeek(base);
  }, [weekOffset, today]);

  const activeWeekKey = useMemo(() => getWeekKey(activeWeekDate), [activeWeekDate]);

  const weekLabel = useMemo(() => {
    const start = activeWeekDate;
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${formatDate(start)} - ${formatDate(end)}`;
  }, [activeWeekDate]);

  const weekRange = useMemo(() => {
    const start = new Date(activeWeekDate);
    const end = new Date(activeWeekDate);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [activeWeekDate]);

  const calendarMonthLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
    }).format(calendarDate);
  }, [calendarDate]);

  const calendarDays = useMemo(() => buildCalendarDays(calendarDate), [calendarDate]);
  const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);
  const backlog = useMemo(() => getBacklogTasks(data.tasks), [data.tasks]);
  const weekTasks = useMemo(() => getWeekTasks(data.tasks, activeWeekKey), [data.tasks, activeWeekKey]);
  const selectedDateEvents = useMemo(
    () => getSelectedDateEvents(data.events, selectedDateKey),
    [data.events, selectedDateKey]
  );

  const weekEvents = useMemo(() => getWeekEvents(data.events, weekRange), [data.events, weekRange]);
  const eventDates = useMemo(() => getEventDates(data.events), [data.events]);
  const dailyTasks = useMemo(() => data.dailyTasks ?? [], [data.dailyTasks]);

  const savedCategories = useMemo(
    () => data.userSettings?.categories ?? [],
    [data.userSettings?.categories]
  );

  const taskCategories = useMemo(() => {
    const filtered = savedCategories.filter((cat) => cat.kind === "task");
    return filtered.length > 0 ? filtered : defaultTaskCategories;
  }, [savedCategories]);

  const eventCategories = useMemo(() => {
    const filtered = savedCategories.filter((cat) => cat.kind === "event");
    return filtered.length > 0 ? filtered : defaultEventCategories;
  }, [savedCategories]);

  const plannedWeekTasks = useMemo(
    () => getTasksByContainer(data.tasks, data.dailyTasks, "week", activeWeekKey), [data.tasks, data.dailyTasks, activeWeekKey]
  );
  const doneWeekTasks = useMemo(
    () => getTasksByContainer(data.tasks, data.dailyTasks, "week-done", activeWeekKey), [data.tasks, data.dailyTasks, activeWeekKey]
  );

  const currentWeekKey = getWeekKey(today);

  const reviewTasks = useMemo(
    () => getReviewTasks(data.tasks, currentWeekKey),
    [data.tasks, currentWeekKey]
  );

  const agendaDays = useMemo(
    () => getAgendaDays(data.events, data.tasks, weekRange),
    [data.events, data.tasks, weekRange]
  );

  const prevWeekKey = useMemo(() => shiftWeekKey(activeWeekKey, -1), [activeWeekKey]);
  const nextWeekKey = useMemo(() => shiftWeekKey(activeWeekKey, 1), [activeWeekKey]);

  return {
    activeWeekDate,
    activeWeekKey,
    prevWeekKey,
    nextWeekKey,
    weekLabel,
    weekRange,
    weekEvents,
    calendarMonthLabel,
    calendarDays,
    selectedDateKey,
    selectedDateEvents,
    weekEventsCount: weekEvents.length,
    eventDates,
    backlog,
    weekTasks,
    dailyTasks,
    currentWeekKey,
    reviewTasks,
    agendaDays,
    plannedWeekTasksCount: plannedWeekTasks.length,
    doneWeekTasksCount: doneWeekTasks.length,
    taskCategories,
    eventCategories,
    allEvents: data.events ?? [],
  };
}
