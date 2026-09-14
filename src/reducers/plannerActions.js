import { plannerActionTypes } from "./plannerReducer.js";

export const addTaskAction = (task) => ({
  type: plannerActionTypes.ADD_TASK,
  payload: task,
});

export const addEventAction = (event) => ({
  type: plannerActionTypes.ADD_EVENT,
  payload: event,
});

export const removeEventAction = (id) => ({
  type: plannerActionTypes.REMOVE_EVENT,
  payload: { id },
});

export const toggleTaskDoneAction = (id, weekKey = null) => ({
  type: plannerActionTypes.TOGGLE_TASK_DONE,
  payload: { id, weekKey },
});

export const moveTaskToWeekAction = (id, weekKey) => ({
  type: plannerActionTypes.MOVE_TASK_TO_WEEK,
  payload: { id, weekKey },
});

export const moveTaskToBacklogAction = (id) => ({
  type: plannerActionTypes.MOVE_TASK_TO_BACKLOG,
  payload: { id },
});

export const addDailyTaskAction = (task) => ({
  type: plannerActionTypes.ADD_DAILY_TASK,
  payload: task,
});

export const toggleDailyTaskDoneAction = (id) => ({
  type: plannerActionTypes.TOGGLE_DAILY_TASK_DONE,
  payload: { id },
});

export const removeDailyTaskAction = (id) => ({
  type: plannerActionTypes.REMOVE_DAILY_TASK,
  payload: { id },
});

export const removeTaskAction = (id) => ({
  type: plannerActionTypes.REMOVE_TASK,
  payload: { id },
});

export const moveTaskByDnDAction = (taskId, toContainer, targetIndex, weekKey) => ({
  type: plannerActionTypes.MOVE_TASK_BY_DND,
  payload: {
    taskId,
    toContainer,
    targetIndex,
    weekKey,
  },
});

export const moveDailyTaskByDnDAction = (taskId, targetIndex) => ({
  type: plannerActionTypes.MOVE_DAILY_TASK_BY_DND,
  payload: {
    taskId,
    targetIndex,
  },
});

export const updateUserSettingsAction = (settings) => ({
  type: plannerActionTypes.UPDATE_USER_SETTINGS,
  payload: settings,
});
