import { taskMembershipKey } from "../utils/plannerSelectors.js";

const ACCEPTS = {
  task: new Set(["task-group", "week-done", "backlog", "week-shift", "day"]),
  event: new Set(["day"]),
  routine: new Set(["routine-list", "routine"]),
};

export function taskDragId(taskId, surface = "card") {
  return surface === "card" ? taskId : `task-ref:${taskId}`;
}

export function eventDragId(eventId, surface) {
  return `event:${eventId}:${surface}`;
}

export function canAccept(kind, destType, source = {}, target = {}) {
  if (!ACCEPTS[kind]?.has(destType)) return false;
  if (kind !== "task" || destType !== "task-group") return true;
  if (target.categoryId !== undefined) {
    return (source.categoryId ?? "") === (target.categoryId ?? "");
  }
  return source.bucket !== "week" || source.weekKey !== target.weekKey;
}

export function getDropBeforeId(tasks, activeId, overId) {
  const target = tasks.find((task) => task.id === overId);
  if (!target) return null;
  const members = tasks
    .filter((task) => taskMembershipKey(task) === taskMembershipKey(target))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const from = members.findIndex((task) => task.id === activeId);
  const to = members.findIndex((task) => task.id === overId);
  return from >= 0 && from < to ? (members[to + 1]?.id ?? null) : overId;
}

export function compatibleCollision(pointer, closest, args) {
  const source = args.active.data.current;
  if (!source) return [];
  const filtered = args.droppableContainers.filter((container) => {
    const target = container.data.current;
    return target && canAccept(source.kind, target.destType, source, target);
  });
  if (filtered.length === 0) return [];
  const next = { ...args, droppableContainers: filtered };
  if (!args.pointerCoordinates) return closest(next);
  const collisions = pointer(next);
  const cardIds = new Set(filtered.filter((container) => container.data.current.recordId).map((container) => container.id));
  const cards = collisions.filter((collision) => cardIds.has(collision.id));
  return cards.length ? cards : collisions;
}
