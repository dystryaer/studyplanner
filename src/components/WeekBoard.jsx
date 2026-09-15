import { useMemo, useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { getIsoWeek, getMondayOfWeekKey } from "../utils/calendar";
import { getWeekCategoryGroups } from "../utils/plannerSelectors";
import { getCategoryCardColors } from "../utils/color";
import DroppableTaskList from "./DroppableTaskList";
import SortableTaskCard from "./SortableTaskCard";
import TaskCard from "./TaskCard";
import WeekAgenda from "./WeekAgenda";

function weekHeading(weekKey) {
  const monday = getMondayOfWeekKey(weekKey);
  if (!monday) return weekKey;
  return `Week ${getIsoWeek(monday).week}`;
}

export default function WeekBoard({
  planner,
  onEditTask,
  onMoveTask,
  onEditEvent,
  onMoveEvent,
}) {
  const [categoryId, setCategoryId] = useState(null);
  const [dueMode, setDueMode] = useState("all");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [doneOpen, setDoneOpen] = useState(false);

  const groups = useMemo(
    () => getWeekCategoryGroups(
      planner.data.tasks,
      planner.taskCategories,
      planner.activeWeekKey,
      { categoryId, dueMode },
      planner.today,
    ),
    [planner.data.tasks, planner.taskCategories, planner.activeWeekKey, categoryId, dueMode, planner.today],
  );

  const plannedIds = groups.flatMap((group) => group.planned.map((task) => task.id));
  const doneIds = groups.flatMap((group) => group.done.map((task) => task.id));
  const doneCount = groups.reduce((sum, group) => sum + group.done.length, 0);

  function toggleGroup(id) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderCard(task, extra = {}) {
    const Card = dueMode === "all" ? SortableTaskCard : TaskCard;
    return (
      <Card
        key={task.id}
        task={task}
        taskCategories={planner.taskCategories}
        onDone={planner.toggleDone}
        onBacklog={planner.sendTaskToBacklog}
        onMoveToWeek={planner.moveTaskToWeek}
        onDelete={planner.removeTask}
        onMove={onMoveTask}
        onEdit={onEditTask}
        compact
        weekKey={planner.activeWeekKey}
        now={planner.today}
        {...extra}
      />
    );
  }

  return (
    <section className="board-grid">
      <section className="board-main">
        {planner.activeWeekKey === planner.currentWeekKey && planner.reviewTasks.length > 0 ? (
          <section className="panel week-review" aria-label="Previous week review">
            <div className="panel-head">
              <h2>Unfinished from earlier weeks</h2>
              <strong>{planner.reviewTasks.length}</strong>
            </div>
            <p className="empty-copy">Carry work into this week or return it to the backlog. Open tasks are never discarded automatically.</p>
            <ul className="review-list">
              {planner.reviewTasks.map((task) => (
                <li key={task.id} className="review-row">
                  <div>
                    <strong>{task.title}</strong>
                    <span>{weekHeading(task.weekKey)}</span>
                  </div>
                  <div className="task-actions">
                    <button type="button" onClick={() => planner.placeTask(task.id, { kind: "week", weekKey: planner.currentWeekKey })}>
                      Carry to this week
                    </button>
                    <button type="button" onClick={() => planner.placeTask(task.id, { kind: "backlog" })}>
                      Move to backlog
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="panel">
          <div className="panel-head">
            <h2>{dueMode === "all" ? "This Week" : dueMode === "overdue" ? "Overdue tasks" : "Upcoming deadlines"}</h2>
            <strong>
              {dueMode === "all" ? `${planner.plannedWeekTasksCount}/${planner.weekTasks.length}` : plannedIds.length}
            </strong>
          </div>

          <div className="week-shift-targets">
            <DroppableTaskList id="week-prev" className="week-shift-drop" destType="week-shift" weekKey={planner.prevWeekKey}>
              Previous week
            </DroppableTaskList>
            <DroppableTaskList id="week-next" className="week-shift-drop" destType="week-shift" weekKey={planner.nextWeekKey}>
              Next week
            </DroppableTaskList>
          </div>

          <div className="week-filters" role="toolbar" aria-label="Week filters">
            <button type="button" className={!categoryId ? "is-active" : ""} onClick={() => setCategoryId(null)}>All</button>
            {planner.taskCategories.map((category) => {
              const colors = getCategoryCardColors(category.baseColor);
              return (
                <button
                  key={category.id}
                  type="button"
                  className={categoryId === category.id ? "is-active" : ""}
                  style={{ borderColor: colors.borderColor }}
                  onClick={() => setCategoryId(category.id)}
                >
                  <span className="task-subject-swatch" style={{ background: category.baseColor }} aria-hidden="true" />
                  {category.label}
                </button>
              );
            })}
            <span className="filter-separator" aria-hidden="true" />
            <button type="button" className={dueMode === "all" ? "is-active" : ""} onClick={() => setDueMode("all")}>All dates</button>
            <button type="button" className={dueMode === "upcoming" ? "is-active" : ""} onClick={() => setDueMode("upcoming")}>Upcoming</button>
            <button type="button" className={dueMode === "overdue" ? "is-active" : ""} onClick={() => setDueMode("overdue")}>Overdue</button>
          </div>

          {dueMode !== "all" ? <p className="empty-copy">Open tasks from all weeks and the backlog, ordered by due date within each category.</p> : null}
          <DroppableTaskList
            disabled={dueMode !== "all"}
            id="week"
            className="task-list droppable-task-list week-groups"
            isEmpty={plannedIds.length === 0}
            destType="task-group"
            weekKey={planner.activeWeekKey}
          >
            <SortableContext items={plannedIds} strategy={verticalListSortingStrategy}>
              {groups.every((group) => group.planned.length === 0) ? (
                <p className="empty-copy">{dueMode === "all" ? "No tasks planned this week yet. Add one without a day, or use Move to to place it on a date." : "No open tasks match these deadlines."}</p>
              ) : (
                groups.map((group) => (
                  <section key={group.category.id} className="week-group" aria-label={group.category.label}>
                    <button
                      type="button"
                      className="week-group-toggle"
                      aria-expanded={!collapsed.has(group.category.id)}
                      onClick={() => toggleGroup(group.category.id)}
                    >
                      <span className="task-subject-swatch" style={{ background: group.category.baseColor }} aria-hidden="true" />
                      <span>{group.category.label}</span>
                      <strong>{group.planned.length}</strong>
                    </button>
                    {collapsed.has(group.category.id) ? null : (
                      <DroppableTaskList id={`group:${group.category.id}`} className="week-group-cards" destType="task-group" categoryId={(group.planned[0] ?? group.done[0]).categoryId ?? ""} weekKey={planner.activeWeekKey} disabled={dueMode !== "all"}>
                        {group.planned.length === 0 ? (
                          <p className="empty-copy">No open tasks in this category.</p>
                        ) : (
                          group.planned.map((task) => renderCard(task))
                        )}
                      </DroppableTaskList>
                    )}
                  </section>
                ))
              )}
            </SortableContext>
          </DroppableTaskList>
        </section>

        {dueMode === "all" ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Done</h2>
            <strong>{planner.doneWeekTasksCount}/{planner.weekTasks.length}</strong>
          </div>
          <button
            type="button"
            className="week-group-toggle"
            aria-expanded={doneOpen}
            onClick={() => setDoneOpen((open) => !open)}
          >
            Completed tasks
            <strong>{doneCount}</strong>
          </button>
          <DroppableTaskList
            disabled={dueMode !== "all"}
            id="week-done"
            className="task-list droppable-task-list"
            isEmpty={doneIds.length === 0}
            destType="week-done"
            weekKey={planner.activeWeekKey}
          >
            <SortableContext items={doneIds} strategy={verticalListSortingStrategy}>
              {!doneOpen ? (
                <p className="empty-copy">{doneCount === 0 ? "No finished tasks in this week yet." : "Completed tasks are collapsed."}</p>
              ) : doneIds.length === 0 ? (
                <p className="empty-copy">No finished tasks in this week yet.</p>
              ) : (
                groups.flatMap((group) => group.done.map((task) => renderCard(task, { destType: "week-done", donePanel: true })))
              )}
            </SortableContext>
          </DroppableTaskList>
        </section>
        ) : null}
      </section>

      <WeekAgenda
        agendaDays={planner.agendaDays}
        taskCategories={planner.taskCategories}
        eventCategories={planner.eventCategories}
        onEditTask={onEditTask}
        onMoveTask={onMoveTask}
        onEditEvent={onEditEvent}
        onMoveEvent={onMoveEvent}
        onDeleteEvent={planner.removeEvent}
      />
    </section>
  );
}
