import { getTaskContainer } from "../utils/plannerSelectors.js";

export const plannerActionTypes = {
  ADD_TASK: "ADD_TASK",
  ADD_EVENT: "ADD_EVENT",
  REMOVE_EVENT: "REMOVE_EVENT",
  TOGGLE_TASK_DONE: "TOGGLE_TASK_DONE",
  MOVE_TASK_TO_WEEK: "MOVE_TASK_TO_WEEK",
  MOVE_TASK_TO_BACKLOG: "MOVE_TASK_TO_BACKLOG",
  ADD_DAILY_TASK: "ADD_DAILY_TASK",
  TOGGLE_DAILY_TASK_DONE: "TOGGLE_DAILY_TASK_DONE",
  REMOVE_DAILY_TASK: "REMOVE_DAILY_TASK",
  REMOVE_TASK: "REMOVE_TASK",
  MOVE_TASK_BY_DND: "MOVE_TASK_BY_DND",
  MOVE_DAILY_TASK_BY_DND: "MOVE_DAILY_TASK_BY_DND",
  UPDATE_USER_SETTINGS: "UPDATE_USER_SETTINGS",
};

function byOrder(a, b) {
  return (a.order ?? 0) - (b.order ?? 0);
}

function reindex(tasks) {
  return tasks.map((task, order) => ({ ...task, order }));
}

function placeTask(tasks, task, index) {
  const container = getTaskContainer(task, task.weekKey);
  const rest = tasks.filter((item) => item.id !== task.id);
  const target = rest.filter((item) => getTaskContainer(item, task.weekKey) === container).sort(byOrder);
  const others = rest.filter((item) => getTaskContainer(item, task.weekKey) !== container);
  target.splice(index, 0, task);
  return [...others, ...reindex(target)];
}

function placeDailyTask(dailyTasks, task, index) {
  const rest = dailyTasks.filter((item) => item.id !== task.id);
  rest.splice(index, 0, { ...task, bucket: "daily" });
  return reindex(rest);
}

function toBacklog(task) {
  return { ...task, bucket: "backlog", weekKey: null, status: "planned" };
}

function toWeek(task, weekKey, status) {
  return { ...task, bucket: "week", weekKey, status };
}

export function plannerReducer(state, action, now) {
  const update = (patch) => ({ ...state, ...patch, updatedAt: now.toISOString() });
  const findTask = (id) => state.tasks.find((task) => task.id === id);

  switch (action.type) {
    case plannerActionTypes.ADD_TASK:
      return update({ tasks: placeTask(state.tasks, action.payload, 0) });

    case plannerActionTypes.ADD_EVENT:
      return update({ events: [action.payload, ...state.events] });

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
      return update({ tasks: placeTask(state.tasks, moved, 0) });
    }

    case plannerActionTypes.MOVE_TASK_TO_WEEK: {
      const task = findTask(action.payload.id);
      if (!task) return state;
      return update({ tasks: placeTask(state.tasks, toWeek(task, action.payload.weekKey, "planned"), 0) });
    }

    case plannerActionTypes.MOVE_TASK_TO_BACKLOG: {
      const task = findTask(action.payload.id);
      if (!task) return state;
      return update({ tasks: placeTask(state.tasks, toBacklog(task), 0) });
    }

    case plannerActionTypes.REMOVE_TASK:
      return update({ tasks: state.tasks.filter((task) => task.id !== action.payload.id) });

    case plannerActionTypes.MOVE_TASK_BY_DND: {
      const { taskId, toContainer, targetIndex, weekKey } = action.payload;
      const task = findTask(taskId);
      if (!task) return state;
      const moved =
        toContainer === "backlog"
          ? toBacklog(task)
          : toWeek(task, weekKey, toContainer === "week-done" ? "done" : "planned");
      return update({ tasks: placeTask(state.tasks, moved, targetIndex) });
    }

    case plannerActionTypes.ADD_DAILY_TASK:
      return update({ dailyTasks: placeDailyTask(state.dailyTasks, action.payload, 0) });

    case plannerActionTypes.TOGGLE_DAILY_TASK_DONE:
      return update({
        dailyTasks: state.dailyTasks.map((task) =>
          task.id === action.payload.id
            ? { ...task, status: task.status === "done" ? "planned" : "done" }
            : task
        ),
      });

    case plannerActionTypes.REMOVE_DAILY_TASK:
      return update({ dailyTasks: state.dailyTasks.filter((task) => task.id !== action.payload.id) });

    case plannerActionTypes.MOVE_DAILY_TASK_BY_DND: {
      const { taskId, targetIndex } = action.payload;
      const task = state.dailyTasks.find((item) => item.id === taskId);
      if (!task) return state;
      return update({ dailyTasks: placeDailyTask(state.dailyTasks, task, targetIndex) });
    }

    case plannerActionTypes.UPDATE_USER_SETTINGS:
      return update({ userSettings: { ...state.userSettings, ...action.payload } });

    default:
      return state;
  }
}
