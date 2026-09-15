import DroppableTaskList from "./DroppableTaskList";
import SortableTaskCard from "./SortableTaskCard";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

export default function DailyTasksPanel({
  dailyTasks,
  taskCategories = [],
  toggleDailyTaskDone,
  skipDailyTask,
  resumeDailyTask,
  pauseDailyTask,
  removeDailyTask,
  collapsed = false,
}) {
  const activeTasks = dailyTasks.filter((task) => !task.paused && task.status !== "skipped");
  const doneDailyCount = activeTasks.filter((task) => task.status === "done").length;

  return (
    <section className={`panel daily-tasks-panel ${collapsed ? "is-collapsed" : ""}`}>
      <div className="panel-head">
        <h2>Daily routines</h2>
        <strong>
          {doneDailyCount}/{activeTasks.length}
        </strong>
      </div>

      {!collapsed && (
        <DroppableTaskList
          id="daily"
          className="task-list compact droppable-task-list"
          isEmpty={dailyTasks.length === 0}
          destType="routine-list"
        >
          <SortableContext
            items={dailyTasks.map((task) => task.id)}
            strategy={verticalListSortingStrategy}
          >
            {dailyTasks.length === 0 ? (
              <p className="empty-copy">No daily routines yet.</p>
            ) : (
              dailyTasks.map((task) => (
                <div key={task.id} className={`routine-row ${task.paused ? "is-paused" : ""} ${task.status}`}>
                  {task.paused ? <span>Paused</span> : task.status === "skipped" ? <span>Skipped today</span> : null}
                  <SortableTaskCard
                    task={{ ...task, bucket: "daily" }}
                    taskCategories={taskCategories}
                    onDone={toggleDailyTaskDone}
                    onDelete={removeDailyTask}
                    compact
                    hideWeekAction
                    destType="routine"
                  />
                  <div className="routine-actions">
                    {task.status === "skipped" ? (
                      <button type="button" onClick={() => resumeDailyTask(task.id)}>Undo skip</button>
                    ) : (
                      <button type="button" onClick={() => skipDailyTask(task.id)}>Skip today</button>
                    )}
                    <button type="button" onClick={() => pauseDailyTask(task.id, !task.paused)}>
                      {task.paused ? "Resume" : "Pause"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </SortableContext>
        </DroppableTaskList>
      )}
    </section>
  );
}
