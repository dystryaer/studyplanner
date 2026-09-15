import {
  addTaskAction, addEventAction, removeEventAction, toggleTaskDoneAction,
  moveTaskToWeekAction, moveTaskToBacklogAction, addDailyTaskAction,
  removeDailyTaskAction, toggleDailyTaskDoneAction, removeTaskAction,
  moveTaskByDnDAction, moveDailyTaskByDnDAction, updateUserSettingsAction,
} from '../reducers/plannerActions.js';

export function usePlannerActions({ dispatch, activeWeekKey, setWeekOffset }) {
  return {
    addTask: draft => dispatch(addTaskAction({
      id: crypto.randomUUID(), title: draft.title.trim(), categoryId: draft.categoryId,
      due: draft.due || null, status: 'planned', bucket: 'backlog', weekKey: null,
    })),
    addEvent: draft => dispatch(addEventAction({
      id: crypto.randomUUID(), title: draft.title.trim(), categoryId: draft.categoryId,
      date: draft.date, startTime: draft.startTime, endTime: draft.endTime,
    })),
    addDailyTask: draft => dispatch(addDailyTaskAction({
      id: crypto.randomUUID(), title: draft.title.trim(), categoryId: draft.categoryId,
      status: 'planned', bucket: 'daily',
    })),
    moveTaskToWeek: id => dispatch(moveTaskToWeekAction(id, activeWeekKey)),
    sendTaskToBacklog: id => dispatch(moveTaskToBacklogAction(id)),
    toggleDone: id => dispatch(toggleTaskDoneAction(id, activeWeekKey)),
    removeEvent: id => dispatch(removeEventAction(id)),
    removeTask: id => dispatch(removeTaskAction(id)),
    toggleDailyTaskDone: id => dispatch(toggleDailyTaskDoneAction(id)),
    removeDailyTask: id => dispatch(removeDailyTaskAction(id)),
    moveTaskByDnD: (id, container, index) => dispatch(moveTaskByDnDAction(id, container, index, activeWeekKey)),
    moveDailyTaskByDnD: (id, index) => dispatch(moveDailyTaskByDnDAction(id, index)),
    updateUserSettings: settings => dispatch(updateUserSettingsAction(settings)),
    goToPreviousWeek: () => setWeekOffset(value => value - 1),
    goToCurrentWeek: () => setWeekOffset(0),
    goToNextWeek: () => setWeekOffset(value => value + 1),
  };
}
