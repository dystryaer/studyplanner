import { parseTaskDestination } from "../domain/plannerState.js";
import { plannerActionTypes } from "./plannerReducer.js";

export const addTaskAction = (task) => ({
  type: plannerActionTypes.ADD_TASK,
  payload: task,
});

export const addEventAction = (event) => ({
  type: plannerActionTypes.ADD_EVENT,
  payload: event,
});

export const updateEventAction = (id, patch) => ({
  type: plannerActionTypes.UPDATE_EVENT,
  payload: { id, patch },
});

export const removeEventAction = (id) => ({
  type: plannerActionTypes.REMOVE_EVENT,
  payload: { id },
});

export const toggleTaskDoneAction = (id, weekKey = null) => ({
  type: plannerActionTypes.TOGGLE_TASK_DONE,
  payload: { id, weekKey },
});

export const updateTaskAction = (id, patch) => ({
  type: plannerActionTypes.UPDATE_TASK,
  payload: { id, ...patch },
});

export const placeTaskAction = (id, destination, beforeId, status) => ({
  type: plannerActionTypes.PLACE_TASK,
  payload: { id, destination: parseTaskDestination(destination), beforeId, status },
});

export const addDailyTaskAction = (task) => ({
  type: plannerActionTypes.ADD_DAILY_TASK,
  payload: task,
});

export const toggleDailyTaskDoneAction = (id) => ({
  type: plannerActionTypes.TOGGLE_DAILY_TASK_DONE,
  payload: { id },
});

export const setDailyTaskStatusAction = (id, status) => ({
  type: plannerActionTypes.SET_DAILY_TASK_STATUS,
  payload: { id, status },
});

export const setDailyTaskPausedAction = (id, paused) => ({
  type: plannerActionTypes.SET_DAILY_TASK_PAUSED,
  payload: { id, paused },
});

export const removeDailyTaskAction = (id) => ({
  type: plannerActionTypes.REMOVE_DAILY_TASK,
  payload: { id },
});

export const removeTaskAction = (id) => ({
  type: plannerActionTypes.REMOVE_TASK,
  payload: { id },
});

export const moveDailyTaskByDnDAction = (taskId, beforeId = null) => ({
  type: plannerActionTypes.MOVE_DAILY_TASK_BY_DND,
  payload: {
    taskId,
    beforeId,
  },
});

export const updateUserSettingsAction = (settings) => ({
  type: plannerActionTypes.UPDATE_USER_SETTINGS,
  payload: settings,
});
