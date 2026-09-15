import { formatDueDate, formatTimeRange, getDueState } from "../utils/date";
import { getCategoryCardColors } from "../utils/color";
import { UndoIcon, CheckIcon, WeekIcon, BacklogIcon, CloseIcon } from "./Icons";
import { defaultTaskCategories } from "../data/defaultCategories";

export default function TaskCard({
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
  dragHandle = null,
  now,
}) {
  const fallbackTaskCategory = defaultTaskCategories[0];
  const legacyLabel = task.subject ?? task.legacyCategoryLabel;

  const category =
    taskCategories.find((item) => item.id === task.categoryId) ??
    taskCategories.find((item) => item.label === legacyLabel);

  const categoryLabel = category?.label ?? legacyLabel ?? fallbackTaskCategory.label;
  const baseColor = category?.baseColor ?? fallbackTaskCategory.baseColor;
  const { softBg, borderColor, textColor } = getCategoryCardColors(baseColor);

  const dueState = getDueState(task.due, now);
  const isUrgent = dueState === "overdue";
  const showReopenButton = donePanel || task.status === "done";
  const slot = task.plannedSlot;
  const plannedLabel = slot
    ? `Planned for: ${formatDueDate(slot.date)}${formatTimeRange(slot.startTime, slot.endTime) ? ` · ${formatTimeRange(slot.startTime, slot.endTime)}` : ""}`
    : null;

  return (
    <article
      className={`task-card ${task.status === "done" ? "is-done" : ""} ${
        compact ? "compact" : ""
      } ${dueState ? `due-${dueState}` : ""}`}
      style={{ background: softBg, borderColor, color: textColor }}
    >
      <div className="task-top">
        <span className="task-subject">
          <span className="task-subject-swatch" style={{ background: baseColor }} aria-hidden="true" />
          {categoryLabel}
        </span>

        <div className="task-actions task-actions-top">
          {dragHandle}
          <button
            type="button"
            onClick={() => onDone(task.id)}
            aria-label={showReopenButton ? "Reopen task" : "Done"}
            title={showReopenButton ? "Reopen task" : "Done"}
          >
            {showReopenButton ? <UndoIcon /> : <CheckIcon />}
          </button>

          {!hideWeekAction &&
            (task.bucket === "backlog" ? (
              <button
                type="button"
                onClick={() => onMoveToWeek(task.id)}
                aria-label="This week"
                title="This week"
              >
                <WeekIcon />
              </button>
            ) : !onMove ? (
              <button
                type="button"
                onClick={() => onBacklog(task.id)}
                aria-label="Into Backlog"
                title="Into Backlog"
              >
                <BacklogIcon />
              </button>
            ) : null)}

          {onMove ? (
            <button type="button" onClick={() => onMove(task)} aria-label="Move to" title="Move to">
              Move to
            </button>
          ) : null}

          {onEdit ? (
            <button type="button" onClick={() => onEdit(task)} aria-label="Edit task" title="Edit task">
              Edit
            </button>
          ) : null}

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete?.(task.id)}
              aria-label="Delete task"
              title="Delete task"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      <h3 className="task-title">
        <span className="task-title-text">{task.title}</span>
      </h3>

      {plannedLabel ? <p className="task-planned">{plannedLabel}</p> : null}

      {task.due && (
        <p className={`task-due ${dueState === "soon" ? "task-due-soon" : ""}`}>
          {isUrgent && (
            <span aria-hidden="true" className="task-alert">
              !{" "}
            </span>
          )}
          Due date: {formatDueDate(task.due)}
        </p>
      )}
    </article>
  );
}
