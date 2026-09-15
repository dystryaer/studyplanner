import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { taskDragId } from "../domain/dragRules.js";
import { formatDueDate, formatTimeRange, formatWeekdayShort } from "../utils/date";
import { getCategoryCardColors } from "../utils/color";
import { defaultTaskCategories } from "../data/defaultCategories";
import DroppableDay from "./DroppableDay";
import EventCard from "./EventCard";
import { GripIcon } from "./Icons";

function AgendaTaskChip({ task, taskCategories, onMove, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: taskDragId(task.id, "agenda"),
    data: { kind: "task", recordId: task.id, categoryId: task.categoryId, bucket: task.bucket, weekKey: task.weekKey },
  });
  const category =
    taskCategories.find((item) => item.id === task.categoryId) ?? defaultTaskCategories[0];
  const colors = getCategoryCardColors(category?.baseColor ?? "#ffda96");
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
    background: colors.softBg,
    borderColor: colors.borderColor,
    color: colors.textColor,
  };

  return (
    <div ref={setNodeRef} className={`agenda-task-chip ${task.status === "done" ? "is-done" : ""}`} style={style}>
      <button type="button" className="drag-handle" aria-label="Drag task" {...listeners} {...attributes}>
        <GripIcon />
      </button>
      <span className="task-subject-swatch" style={{ background: category?.baseColor }} aria-hidden="true" />
      <strong>{task.title}</strong>
      <span className="agenda-task-category">{category.label}</span>
      {task.status === "done" ? <span className="agenda-task-status">Done</span> : null}
      <span className="agenda-task-time">{formatTimeRange(task.plannedSlot?.startTime, task.plannedSlot?.endTime)}</span>
      {onEdit ? (
        <button type="button" onClick={() => onEdit(task)} aria-label="Edit task">Edit</button>
      ) : null}
      {onMove ? (
        <button type="button" onClick={() => onMove(task)} aria-label="Move to">Move to</button>
      ) : null}
    </div>
  );
}

export default function WeekAgenda({
  agendaDays,
  taskCategories,
  eventCategories,
  onEditTask,
  onMoveTask,
  onEditEvent,
  onMoveEvent,
  onDeleteEvent,
}) {
  return (
    <aside className="panel week-agenda" aria-label="Weekly agenda">
      <div className="panel-head">
        <h2>Agenda</h2>
      </div>
      <div className="agenda-days">
        {agendaDays.map((day) => (
          <DroppableDay
            key={day.dateKey}
            id={`agenda-day:${day.dateKey}`}
            date={day.dateKey}
            className="agenda-day"
          >
            <h3>
              <span>{formatWeekdayShort(day.dateKey)}</span>
              <span>{formatDueDate(day.dateKey)}</span>
            </h3>
            {day.events.length === 0 && day.tasks.length === 0 ? (
              <p className="empty-copy">Nothing planned.</p>
            ) : null}
            {day.events.map((event) => (
              <EventCard
                key={`agenda-${event.id}`}
                event={event}
                eventCategories={eventCategories}
                surface="agenda"
                onEdit={onEditEvent}
                onMove={onMoveEvent}
                onDelete={onDeleteEvent}
              />
            ))}
            {day.tasks.map((task) => (
              <AgendaTaskChip
                key={`agenda-task-${task.id}`}
                task={task}
                taskCategories={taskCategories}
                onEdit={onEditTask}
                onMove={onMoveTask}
              />
            ))}
          </DroppableDay>
        ))}
      </div>
    </aside>
  );
}
