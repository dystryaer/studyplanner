import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import TaskCard from "./TaskCard";
import { GripIcon } from "./Icons";

export default function SortableTaskCard({
  task,
  taskCategories = [],
  onDone,
  onBacklog,
  onMoveToWeek,
  onDelete,
  onMove,
  onEdit,
  compact = false,
  hideWeekAction = false,
  donePanel = false,
  destType = "task-group",
  weekKey,
  now,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      kind: task.bucket === "daily" ? "routine" : "task",
      destType: task.bucket === "daily" ? "routine" : destType,
      recordId: task.id,
      categoryId: task.categoryId,
      bucket: task.bucket,
      status: task.status,
      weekKey,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 999 : "auto",
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-task-card ${isDragging ? "is-dragging" : ""}`}
    >
      <TaskCard
        task={task}
        taskCategories={taskCategories}
        onDone={onDone}
        onBacklog={onBacklog}
        onMoveToWeek={onMoveToWeek}
        onDelete={onDelete}
        onMove={onMove}
        onEdit={onEdit}
        compact={compact}
        hideWeekAction={hideWeekAction}
        donePanel={donePanel}
        now={now}
        dragHandle={(
          <button
            type="button"
            className="drag-handle"
            aria-label="Drag task"
            title="Drag task"
            {...attributes}
            {...listeners}
          >
            <GripIcon />
          </button>
        )}
      />
    </div>
  );
}
