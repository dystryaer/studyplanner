import CalendarPanel from "./CalendarPanel";
import SortableTaskCard from "./SortableTaskCard";
import DroppableTaskList from "./DroppableTaskList";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

export default function WeekBoard({
  weekTasks,
  plannedWeekTasks,
  doneWeekTasks,
  taskCategories = [],
  toggleDone,
  sendTaskToBacklog,
  moveTaskToWeek,
  calendarMonthLabel,
  calendarDays,
  selectedDate,
  selectedDateKey,
  selectedDateEvents,
  eventDates,
  eventCategories,
  setCalendarDate,
  setSelectedDate,
  removeEvent,
  removeTask,
  weekRange,
  activeWeekDate,
  setWeekOffset,
  allEvents,
}) {

  return (
    <section className="board-grid">
      <section className="board-main">
        <section className="panel">
          <div className="panel-head">
            <h2>This Week</h2>
            <strong>
              {plannedWeekTasks.length}/{weekTasks.length}
            </strong>
          </div>

          <DroppableTaskList
            id="week"
            className="task-list droppable-task-list"
            isEmpty={plannedWeekTasks.length === 0}
          >
            <SortableContext
              items={plannedWeekTasks.map((task) => task.id)}
              strategy={rectSortingStrategy}
            >
              {plannedWeekTasks.length === 0 ? (
                <p className="empty-copy">No tasks planned this week yet.</p>
              ) : (
                plannedWeekTasks.map((task) => (
                  <SortableTaskCard
                    key={task.id}
                    task={task}
                    taskCategories={taskCategories}
                    onDone={toggleDone}
                    onBacklog={sendTaskToBacklog}
                    onMoveToWeek={moveTaskToWeek}
                    onDelete={removeTask}
                  />
                ))
              )}
            </SortableContext>
          </DroppableTaskList>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Done</h2>
            <strong>{doneWeekTasks.length}/{weekTasks.length}</strong>
          </div>

          <DroppableTaskList
            id="week-done"
            className="task-list droppable-task-list"
            isEmpty={doneWeekTasks.length === 0}
          >
            <SortableContext
              items={doneWeekTasks.map((task) => task.id)}
              strategy={rectSortingStrategy}
            >
              {doneWeekTasks.length === 0 ? (
                <p className="empty-copy">No finished tasks in this week yet.</p>
              ) : (
                doneWeekTasks.map((task) => (
                  <SortableTaskCard
                    key={task.id}
                    task={task}
                    taskCategories={taskCategories}
                    onDone={toggleDone}
                    onBacklog={sendTaskToBacklog}
                    onMoveToWeek={moveTaskToWeek}
                    onDelete={removeTask}
                  />
                ))
              )}
            </SortableContext>
          </DroppableTaskList>
        </section>
      </section>

      <CalendarPanel
        calendarMonthLabel={calendarMonthLabel}
        calendarDays={calendarDays}
        selectedDate={selectedDate}
        selectedDateKey={selectedDateKey}
        selectedDateEvents={selectedDateEvents}
        eventDates={eventDates}
        eventCategories={eventCategories}
        setCalendarDate={setCalendarDate}
        setSelectedDate={setSelectedDate}
        removeEvent={removeEvent}
        weekRange={weekRange}
        activeWeekDate={activeWeekDate}
        setWeekOffset={setWeekOffset}
        allEvents={allEvents}
      />
    </section>
  );
}