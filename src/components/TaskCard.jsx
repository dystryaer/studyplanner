import { formatDueDate, getDueState } from "../utils/date";
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
  compact = false,
  hideWeekAction = false,
  hideDeleteAction = false,
  donePanel = false,
}) {
  const fallbackTaskCategory = defaultTaskCategories[0];
  const legacyLabel = task.subject ?? task.legacyCategoryLabel;

  const category =
    taskCategories.find((item) => item.id === task.categoryId) ??
    taskCategories.find((item) => item.label === legacyLabel);

  const categoryLabel = category?.label ?? legacyLabel ?? fallbackTaskCategory.label;
  const baseColor = category?.baseColor ?? fallbackTaskCategory.baseColor;
  const { softBg, borderColor, textColor } = getCategoryCardColors(baseColor);

  const dueState = getDueState(task.due);
  const isUrgent = dueState === "overdue";
  const showReopenButton = donePanel || task.status === "done";

  return (
    <article
      className={`task-card ${task.status === "done" ? "is-done" : ""} ${
        compact ? "compact" : ""
      } ${dueState ? `due-${dueState}` : ""}`}
      style={{ background: softBg, borderColor, color: textColor }}
    >
      <div className="task-top">
        <span className="task-subject">{categoryLabel}</span>

        <div className="task-actions task-actions-top">
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
            ) : (
              <button
                type="button"
                onClick={() => onBacklog(task.id)}
                aria-label="Into Backlog"
                title="Into Backlog"
              >
                <BacklogIcon />
              </button>
            ))}

          {!hideDeleteAction && (
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

      {task.due && (
        <p className={`task-due ${dueState === "soon" ? "task-due-soon" : ""}`}>
          {isUrgent && (
            <span aria-hidden="true" className="task-alert">
              ❗{" "}
            </span>
          )}
          Due: {formatDueDate(task.due)}
        </p>
      )}
    </article>
  );
}
