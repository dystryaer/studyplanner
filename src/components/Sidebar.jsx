import { TaskTabIcon, EventTabIcon, RepeatIcon, CloseIcon } from "./Icons";
import TaskForm from "./TaskForm";
import EventForm from "./EventForm";
import BacklogPanel from "./BacklogPanel";
import DailyTaskForm from "./DailyTaskForm";
import DailyTasksPanel from "./DailyTasksPanel";

export default function Sidebar({
  hidden = false,
  sidebarMode,
  setSidebarMode,
  addTask,
  addEvent,
  addDailyTask,
  backlog,
  toggleDone,
  sendTaskToBacklog,
  moveTaskToWeek,
  dailyTasks,
  toggleDailyTaskDone,
  skipDailyTask,
  resumeDailyTask,
  pauseDailyTask,
  removeDailyTask,
  removeTask,
  taskCategories,
  eventCategories,
  showLists = true,
  onClose,
  onMoveTask,
  onEditTask,
  now,
}) {
    function toggleSidebarMode(mode) {
        setSidebarMode((prev) => (prev === mode ? null : mode));
    }

    return (
        <aside className="sidebar" hidden={hidden}>
            <div className="brand">
                <div className="brand-mark" aria-hidden="true">
                    <svg viewBox="0 0 48 48" role="img" aria-label="Lernplan Logo">
                        <rect x="6" y="8" width="36" height="32" rx="8" stroke="currentColor" strokeWidth="3" fill="none" />
                        <path d="M16 18h16M16 24h10M16 30h8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                </div>

                <div>
                    <h1>Study Planner</h1>
                </div>
                {onClose ? (
                  <button type="button" className="ghost-btn" onClick={onClose} aria-label="Close add panel">
                    <CloseIcon />
                  </button>
                ) : null}
            </div>

            <section className='panel'>
                <div className='mode-switch'>
                <button
                    type="button"
                    className={sidebarMode === 'task' ? 'mode-btn active' : 'mode-btn'}
                    onClick={() => toggleSidebarMode('task')}
                    aria-label="New Task"
                    aria-pressed={sidebarMode === "task"}
                    title="New Task"
                >
                    <TaskTabIcon />
                </button>

                <button
                    type="button"
                    className={sidebarMode === 'event' ? 'mode-btn active' : 'mode-btn'}
                    onClick={() => toggleSidebarMode('event')}
                    aria-pressed={sidebarMode === "event"}
                    aria-label="New Event"
                    title="New Event"
                >
                    <EventTabIcon />
                </button>

                <button
                    type="button"
                    className={sidebarMode === "daily" ? "mode-btn active" : "mode-btn"}
                    onClick={() => toggleSidebarMode("daily")}
                    aria-pressed={sidebarMode === "daily"}
                    aria-label="New Daily Task"
                    title="New Daily Task"
                >
                    <RepeatIcon />
                </button>

                </div>
            </section>

            <div hidden={sidebarMode !== "task"}>
                <TaskForm
                    addTask={addTask}
                    taskCategories={taskCategories}
                />
            </div>

            <div hidden={sidebarMode !== "event"}>
                <EventForm
                    addEvent={addEvent}
                    eventCategories={eventCategories}
                />
            </div>

            <div hidden={sidebarMode !== "daily"}>
                <DailyTaskForm
                    addDailyTask={addDailyTask}
                    taskCategories={taskCategories}
                />
            </div>

            {showLists ? (
              <>
                <DailyTasksPanel
                    dailyTasks={dailyTasks}
                    taskCategories={taskCategories}
                    toggleDailyTaskDone={toggleDailyTaskDone}
                    skipDailyTask={skipDailyTask}
                    resumeDailyTask={resumeDailyTask}
                    pauseDailyTask={pauseDailyTask}
                    removeDailyTask={removeDailyTask}
                    collapsed={sidebarMode === "task" || sidebarMode === "event"}
                />

                <BacklogPanel
                    backlog={backlog}
                    taskCategories={taskCategories}
                    toggleDone={toggleDone}
                    sendTaskToBacklog={sendTaskToBacklog}
                    moveTaskToWeek={moveTaskToWeek}
                    removeTask={removeTask}
                    onMove={onMoveTask}
                    onEdit={onEditTask}
                    collapsed={sidebarMode === "daily" || sidebarMode === "event"}
                    now={now}
                />
              </>
            ) : null}
        </aside>
    );
}
