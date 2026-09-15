import DroppableTaskList from "./DroppableTaskList";
import SortableTaskCard from "./SortableTaskCard";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

export default function DailyTasksPanel({
  dailyTasks,
  taskCategories = [],
  toggleDailyTaskDone,
  removeDailyTask,
  collapsed = false,
}) {
  const doneDailyCount = dailyTasks.filter((t) => t.status === "done").length;

  return (
    <section className={`panel daily-tasks-panel ${collapsed ? "is-collapsed" : ""}`}>
      <div className="panel-head">
        <h2>Daily Tasks</h2>
        <strong>
          {doneDailyCount}/{dailyTasks.length}
        </strong>
      </div>

      {!collapsed && (
        <DroppableTaskList
          id="daily"
          className="task-list compact droppable-task-list"
          isEmpty={dailyTasks.length === 0}
        >
          <SortableContext
            items={dailyTasks.map((task) => task.id)}
            strategy={verticalListSortingStrategy}
          >
            {dailyTasks.length === 0 ? (
              <p className="empty-copy">No daily tasks yet.</p>
            ) : (
              dailyTasks.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={{ ...task, bucket: "daily" }}
                  taskCategories={taskCategories}
                  onDone={toggleDailyTaskDone}
                  onDelete={removeDailyTask}
                  compact
                  hideWeekAction
                />
              ))
            )}
          </SortableContext>
        </DroppableTaskList>
      )}
    </section>
  );
}
