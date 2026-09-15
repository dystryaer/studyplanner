import {
  addTaskAction, addEventAction, updateEventAction, removeEventAction, toggleTaskDoneAction,
  updateTaskAction, placeTaskAction,
  addDailyTaskAction,
  removeDailyTaskAction, toggleDailyTaskDoneAction, setDailyTaskStatusAction,
  setDailyTaskPausedAction, removeTaskAction,
  moveDailyTaskByDnDAction, updateUserSettingsAction,
} from '../reducers/plannerActions.js';

export function usePlannerActions({ dispatch, activeWeekKey, setWeekOffset }) {
  return {
    addTask: draft => dispatch(addTaskAction({
      id: crypto.randomUUID(), title: draft.title.trim(), categoryId: draft.categoryId,
      due: draft.due || null, status: 'planned', bucket: 'backlog', weekKey: null, plannedSlot: null,
    })),
    addEvent: draft => dispatch(addEventAction({
      id: crypto.randomUUID(), title: draft.title.trim(), categoryId: draft.categoryId,
      date: draft.date, startTime: draft.startTime, endTime: draft.endTime,
    })),
    addDailyTask: draft => dispatch(addDailyTaskAction({
      id: crypto.randomUUID(), title: draft.title.trim(), categoryId: draft.categoryId,
      status: 'planned', bucket: 'daily', paused: false,
    })),
    moveTaskToWeek: id => dispatch(placeTaskAction(id, { kind: 'week', weekKey: activeWeekKey })),
    sendTaskToBacklog: id => dispatch(placeTaskAction(id, { kind: 'backlog' })),
    placeTask: (id, destination, beforeId, status) => dispatch(placeTaskAction(id, destination, beforeId, status)),
    updateTask: (id, patch) => dispatch(updateTaskAction(id, patch)),
    toggleDone: id => dispatch(toggleTaskDoneAction(id, activeWeekKey)),
    updateEvent: (id, patch) => dispatch(updateEventAction(id, patch)),
    removeEvent: id => dispatch(removeEventAction(id)),
    removeTask: id => dispatch(removeTaskAction(id)),
    toggleDailyTaskDone: id => dispatch(toggleDailyTaskDoneAction(id)),
    skipDailyTask: id => dispatch(setDailyTaskStatusAction(id, 'skipped')),
    resumeDailyTask: id => dispatch(setDailyTaskStatusAction(id, 'planned')),
    pauseDailyTask: (id, paused) => dispatch(setDailyTaskPausedAction(id, paused)),
    removeDailyTask: id => dispatch(removeDailyTaskAction(id)),
    moveDailyTaskByDnD: (id, beforeId) => dispatch(moveDailyTaskByDnDAction(id, beforeId)),
    updateUserSettings: settings => dispatch(updateUserSettingsAction(settings)),
    goToPreviousWeek: () => setWeekOffset(value => value - 1),
    goToCurrentWeek: () => setWeekOffset(0),
    goToNextWeek: () => setWeekOffset(value => value + 1),
  };
}
