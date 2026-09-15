import { applyTaskDestination } from "../domain/plannerState.js";
import { taskMembershipKey } from "../utils/plannerSelectors.js";

export const plannerActionTypes = {
  ADD_TASK: "ADD_TASK",
  ADD_EVENT: "ADD_EVENT",
  UPDATE_EVENT: "UPDATE_EVENT",
  REMOVE_EVENT: "REMOVE_EVENT",
  TOGGLE_TASK_DONE: "TOGGLE_TASK_DONE",
  UPDATE_TASK: "UPDATE_TASK",
  PLACE_TASK: "PLACE_TASK",
  ADD_DAILY_TASK: "ADD_DAILY_TASK",
  TOGGLE_DAILY_TASK_DONE: "TOGGLE_DAILY_TASK_DONE",
  SET_DAILY_TASK_STATUS: "SET_DAILY_TASK_STATUS",
  SET_DAILY_TASK_PAUSED: "SET_DAILY_TASK_PAUSED",
  REMOVE_DAILY_TASK: "REMOVE_DAILY_TASK",
  REMOVE_TASK: "REMOVE_TASK",
  MOVE_DAILY_TASK_BY_DND: "MOVE_DAILY_TASK_BY_DND",
  UPDATE_USER_SETTINGS: "UPDATE_USER_SETTINGS",
};

function byOrder(a, b) {
  return (a.order ?? 0) - (b.order ?? 0);
}

function reindex(tasks) {
  return tasks.map((task, order) => ({ ...task, order }));
}

function membershipIndex(tasks, task) {
  const members = tasks.filter((item) => taskMembershipKey(item) === taskMembershipKey(task)).sort(byOrder);
  const index = members.findIndex((item) => item.id === task.id);
  return index === -1 ? null : index;
}

function placeInMembership(tasks, task, beforeId, mode = "append") {
  const priorIndex = membershipIndex(tasks, task);
  const rest = tasks.filter((item) => item.id !== task.id);
  const key = taskMembershipKey(task);
  const members = rest.filter((item) => taskMembershipKey(item) === key).sort(byOrder);
  const others = rest.filter((item) => taskMembershipKey(item) !== key);
  let index = mode === "start" ? 0 : members.length;
  if (mode === "keep" && priorIndex !== null) index = Math.min(priorIndex, members.length);
  if (beforeId) {
    const beforeIndex = members.findIndex((item) => item.id === beforeId);
    if (beforeIndex !== -1) index = beforeIndex;
    else if (priorIndex !== null) index = Math.min(priorIndex, members.length);
  }
  members.splice(index, 0, task);
  return [...others, ...reindex(members)];
}

function placeDailyTask(dailyTasks, task, beforeId) {
  const rest = dailyTasks.filter((item) => item.id !== task.id);
  let index = rest.length;
  if (beforeId) {
    const beforeIndex = rest.findIndex((item) => item.id === beforeId);
    if (beforeIndex !== -1) index = beforeIndex;

  }
  rest.splice(index, 0, { ...task, bucket: "daily" });
  return reindex(rest);
}

function toWeek(task, weekKey, status) {
  return { ...applyTaskDestination(task, { kind: "week", weekKey }), status };
}

export function plannerReducer(state, action, now) {
  const update = (patch) => ({ ...state, ...patch, updatedAt: now.toISOString() });
  const findTask = (id) => state.tasks.find((task) => task.id === id);

  switch (action.type) {
    case plannerActionTypes.ADD_TASK:
      return update({
        tasks: placeInMembership(
          state.tasks,
          { ...action.payload, plannedSlot: action.payload.plannedSlot ?? null },
          action.payload.beforeId ?? null,
          "start",
        ),
      });

    case plannerActionTypes.ADD_EVENT:
      return update({ events: [action.payload, ...state.events] });

    case plannerActionTypes.UPDATE_EVENT: {
      const { id, patch } = action.payload;
      const event = state.events.find((item) => item.id === id);
      if (!event) return state;
      return update({
        events: state.events.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      });
    }

    case plannerActionTypes.REMOVE_EVENT:
      return update({ events: state.events.filter((event) => event.id !== action.payload.id) });

    case plannerActionTypes.TOGGLE_TASK_DONE: {
      const task = findTask(action.payload.id);
      if (!task) return state;
      const done = task.status !== "done";
      const moved =
        task.bucket === "backlog" && done
          ? toWeek(task, action.payload.weekKey ?? null, "done")
          : { ...task, status: done ? "done" : "planned" };
      return update({ tasks: placeInMembership(state.tasks, moved, null, "start") });
    }

    case plannerActionTypes.UPDATE_TASK: {
      const task = findTask(action.payload.id);
      if (!task) return state;
      const { title, categoryId, due } = action.payload;
      const next = {
        ...task,
        ...(title !== undefined ? { title } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(due !== undefined ? { due } : {}),
      };
      const mode = categoryId !== undefined && categoryId !== task.categoryId ? "start" : "keep";
      return update({ tasks: placeInMembership(state.tasks, next, null, mode) });
    }

    case plannerActionTypes.PLACE_TASK: {
      const task = findTask(action.payload.id);
      if (!task) return state;
      const moved = {
        ...applyTaskDestination(task, action.payload.destination),
        status: action.payload.status ?? task.status,
      };
      const mode = action.payload.beforeId === undefined ? "keep" : "append";
      return update({ tasks: placeInMembership(state.tasks, moved, action.payload.beforeId, mode) });
    }

    case plannerActionTypes.REMOVE_TASK:
      return update({ tasks: state.tasks.filter((task) => task.id !== action.payload.id) });

    case plannerActionTypes.ADD_DAILY_TASK:
      return update({ dailyTasks: placeDailyTask(state.dailyTasks, { ...action.payload, paused: action.payload.paused === true }, action.payload.beforeId ?? null) });

    case plannerActionTypes.TOGGLE_DAILY_TASK_DONE:
      return update({
        dailyTasks: state.dailyTasks.map((task) =>
          task.id === action.payload.id
            ? { ...task, status: task.status === "done" ? "planned" : "done" }
            : task
        ),
      });

    case plannerActionTypes.SET_DAILY_TASK_STATUS: {
      const status = action.payload.status;
      if (status !== "planned" && status !== "done" && status !== "skipped") return state;
      return update({
        dailyTasks: state.dailyTasks.map((task) =>
          task.id === action.payload.id ? { ...task, status } : task
        ),
      });
    }

    case plannerActionTypes.SET_DAILY_TASK_PAUSED:
      return update({
        dailyTasks: state.dailyTasks.map((task) =>
          task.id === action.payload.id ? { ...task, paused: action.payload.paused === true } : task
        ),
      });

    case plannerActionTypes.REMOVE_DAILY_TASK:
      return update({ dailyTasks: state.dailyTasks.filter((task) => task.id !== action.payload.id) });

    case plannerActionTypes.MOVE_DAILY_TASK_BY_DND: {
      const { taskId, beforeId } = action.payload;
      const task = state.dailyTasks.find((item) => item.id === taskId);
      if (!task) return state;
      return update({ dailyTasks: placeDailyTask(state.dailyTasks, task, beforeId ?? null) });
    }

    case plannerActionTypes.UPDATE_USER_SETTINGS:
      return update({ userSettings: { ...state.userSettings, ...action.payload } });

    default:
      return state;
  }
}
