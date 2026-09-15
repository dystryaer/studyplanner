import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { defaultEventCategories } from "../data/defaultCategories";
import { eventDragId } from "../domain/dragRules.js";
import { mixHex, getReadableTextColor } from "../utils/color";
import { formatDueDate, formatWeekdayShort } from "../utils/date";
import { CloseIcon, GripIcon } from "./Icons";

export default function EventCard({
  event,
  eventCategories = [],
  surface,
  showDate = false,
  onEdit,
  onMove,
  onDelete,
  draggable = true,
}) {
  const category =
    eventCategories.find((item) => item.id === event.categoryId) ||
    defaultEventCategories.find((item) => item.id === event.categoryId);

  const categoryLabel = category?.label ?? "Other";
  const baseColor = category?.baseColor ?? "#ffeedb";
  const cardBg = mixHex(baseColor, "#fbfbf8", 0.88);
  const cardBorder = mixHex(baseColor, "#d4d1ca", 0.45);
  const cardText = getReadableTextColor(cardBg);
  const dragId = eventDragId(event.id, surface);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { kind: "event", recordId: event.id },
    disabled: !draggable,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <article
      ref={setNodeRef}
      style={{ ...style, background: cardBg, borderColor: cardBorder, color: cardText }}
      className={`event-card ${event.categoryId ?? "other"} ${isDragging ? "is-dragging" : ""}`}
      role="group"
      aria-label={event.title}
    >
      <div className="event-card-top">
        {draggable ? (
        <button
          type="button"
          className="drag-handle"
          aria-label="Drag appointment"
          title="Drag appointment"
          {...listeners}
          {...attributes}
        >
          <GripIcon />
        </button>
        ) : null}
        <strong>{event.title}</strong>
        <div className="task-actions task-actions-top">
          {onEdit ? (
            <button type="button" onClick={() => onEdit(event)} aria-label="Edit appointment" title="Edit appointment">
              Edit
            </button>
          ) : null}
          {onMove ? (
            <button type="button" onClick={() => onMove(event)} aria-label="Move appointment" title="Move appointment">
              Move to
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" onClick={() => onDelete(event.id)} aria-label="Delete Event" title="Delete Event">
              <CloseIcon />
            </button>
          ) : null}
        </div>
      </div>
      <p>
        {showDate ? `${formatWeekdayShort(event.date)} · ${formatDueDate(event.date)} · ` : ""}
        {event.startTime}{event.endTime ? ` - ${event.endTime}` : ""} · {categoryLabel}
      </p>
    </article>
  );
}
