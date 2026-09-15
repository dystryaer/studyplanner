import { useMemo, useRef, useState } from "react";
import Topbar from "./components/Topbar";
import Sidebar from "./components/Sidebar";
import WeekBoard from "./components/WeekBoard";
import CalendarPanel from "./components/CalendarPanel";
import DailyTasksPanel from "./components/DailyTasksPanel";
import BacklogPanel from "./components/BacklogPanel";
import SettingsModal from "./components/SettingsModal";
import TaskCard from "./components/TaskCard";
import EventCard from "./components/EventCard";
import MobileNav from "./components/MobileNav";
import MoveDialog from "./components/MoveDialog";
import TaskEditDialog from "./components/TaskEditDialog";
import EventEditDialog from "./components/EventEditDialog";
import { usePlannerData } from "./hooks/usePlannerData";
import { useMediaQuery } from "./hooks/useMediaQuery";
import PlannerStatus from "./components/PlannerStatus";
import { canAccept, compatibleCollision, getDropBeforeId } from "./domain/dragRules.js";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import "./styles/board.css";
import "./styles/task-card.css";
import "./styles/calendar.css";
import "./styles/topbar.css";
import "./styles/sidebar.css";
import "./styles/settings-modal.css";
import "./styles/week.css";

function App({ authUser, onLogout }) {
  const planner = usePlannerData(authUser.id);
  const isMobile = useMediaQuery("(max-width: 1100px)");
  const hasOpened = useRef(false);
  if (planner.canEdit) hasOpened.current = true;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mainView, setMainView] = useState("week");
  const [composeOpen, setComposeOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [editEvent, setEditEvent] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const overlayRecord = useMemo(() => {
    if (!activeDrag) return null;
    if (activeDrag.kind === "event") {
      return planner.allEvents.find((event) => event.id === activeDrag.recordId) ?? null;
    }
    if (activeDrag.kind === "routine") {
      return planner.dailyTasks.find((task) => task.id === activeDrag.recordId) ?? null;
    }
    return planner.data.tasks.find((task) => task.id === activeDrag.recordId) ?? null;
  }, [activeDrag, planner.allEvents, planner.dailyTasks, planner.data.tasks]);

  function handleDragStart(event) {
    setActiveDrag(event.active.data.current);
  }

  function handleDragCancel() {
    setActiveDrag(null);
  }

  function handleDragEnd({ active, over }) {
    setActiveDrag(null);
    const source = active.data.current;
    const target = over?.data.current;
    if (!source || !target || !canAccept(source.kind, target.destType, source, target)) return;
    const id = source.recordId;
    if (id === target.recordId) return;

    if (source.kind === "event") {
      planner.updateEvent(id, { date: target.date });
      return;
    }
    if (source.kind === "routine") {
      planner.moveDailyTaskByDnD(id, getDropBeforeId(planner.dailyTasks, id, target.recordId));
      return;
    }

    const task = planner.data.tasks.find((item) => item.id === id);
    const beforeId = getDropBeforeId(planner.data.tasks, id, target.recordId);
    if (target.destType === "day") {
      planner.placeTask(id, { kind: "day", date: target.date });
    } else if (target.destType === "backlog") {
      planner.placeTask(id, { kind: "backlog" }, beforeId);
    } else if (target.destType === "week-shift") {
      planner.placeTask(id, { kind: "week", weekKey: target.weekKey });
    } else {
      const weekKey = target.weekKey ?? planner.activeWeekKey;
      const destination = task.weekKey === weekKey && task.plannedSlot
        ? { kind: "day", date: task.plannedSlot.date }
        : { kind: "week", weekKey };
      planner.placeTask(id, destination, beforeId, target.destType === "week-done" ? "done" : "planned");
    }
  }

  const visibleView = !isMobile && mainView !== "calendar" ? "week" : mainView;

  if (!planner.canEdit && !hasOpened.current) {
    return <div className="planner-start"><PlannerStatus planner={planner} /><button onClick={onLogout}>Sign out</button></div>;
  }

  return (
    <>
    <PlannerStatus planner={planner} />
    <div inert={!planner.canEdit && planner.status !== "error" ? "" : undefined}>
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => compatibleCollision(pointerWithin, closestCorners, args)}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div className={`app-shell ${isMobile ? "is-mobile" : ""}`}>
        <Sidebar
            hidden={isMobile && !composeOpen}
            sidebarMode={planner.sidebarMode}
            setSidebarMode={planner.setSidebarMode}
            addTask={planner.addTask}
            addEvent={planner.addEvent}
            addDailyTask={planner.addDailyTask}
            backlog={planner.backlog}
            dailyTasks={planner.dailyTasks}
            toggleDone={planner.toggleDone}
            sendTaskToBacklog={planner.sendTaskToBacklog}
            moveTaskToWeek={planner.moveTaskToWeek}
            toggleDailyTaskDone={planner.toggleDailyTaskDone}
            skipDailyTask={planner.skipDailyTask}
            resumeDailyTask={planner.resumeDailyTask}
            pauseDailyTask={planner.pauseDailyTask}
            removeDailyTask={planner.removeDailyTask}
            removeTask={planner.removeTask}
            taskCategories={planner.taskCategories}
            eventCategories={planner.eventCategories}
            showLists={!isMobile}
            onClose={isMobile ? () => setComposeOpen(false) : undefined}
            onMoveTask={(task) => setMoveTarget({ kind: "task", record: task })}
            onEditTask={setEditTask}
            now={planner.today}
        />

        <main className="main">
          <Topbar
            weekLabel={planner.weekLabel}
            plannedWeekTasksCount={planner.plannedWeekTasksCount}
            doneWeekTasksCount={planner.doneWeekTasksCount}
            weekEventsCount={planner.weekEventsCount}
            goToPreviousWeek={planner.goToPreviousWeek}
            goToCurrentWeek={planner.goToCurrentWeek}
            goToNextWeek={planner.goToNextWeek}
            activeWeekDate={planner.activeWeekDate}
            onOpenSettings={() => setSettingsOpen(true)}
            authUser={authUser}
            onLogout={onLogout}
            mainView={visibleView}
            onMainViewChange={setMainView}
            showViewSwitch={!isMobile}
          />

          {visibleView === "week" ? (
            <WeekBoard
              planner={planner}
              onEditTask={setEditTask}
              onMoveTask={(task) => setMoveTarget({ kind: "task", record: task })}
              onEditEvent={setEditEvent}
              onMoveEvent={(event) => setMoveTarget({ kind: "event", record: event })}
            />
          ) : null}

          {visibleView === "calendar" ? (
            <CalendarPanel
              calendarMonthLabel={planner.calendarMonthLabel}
              calendarDays={planner.calendarDays}
              selectedDate={planner.selectedDate}
              selectedDateKey={planner.selectedDateKey}
              selectedDateEvents={planner.selectedDateEvents}
              eventDates={planner.eventDates}
              eventCategories={planner.eventCategories}
              setCalendarDate={planner.setCalendarDate}
              setSelectedDate={planner.setSelectedDate}
              removeEvent={planner.removeEvent}
              onEditEvent={setEditEvent}
              onMoveEvent={(event) => setMoveTarget({ kind: "event", record: event })}
              weekRange={planner.weekRange}
              activeWeekDate={planner.activeWeekDate}
              setWeekOffset={planner.setWeekOffset}
              allEvents={planner.allEvents}
            />
          ) : null}

          {isMobile && mainView === "routines" ? (
            <DailyTasksPanel
              dailyTasks={planner.dailyTasks}
              taskCategories={planner.taskCategories}
              toggleDailyTaskDone={planner.toggleDailyTaskDone}
              skipDailyTask={planner.skipDailyTask}
              resumeDailyTask={planner.resumeDailyTask}
              pauseDailyTask={planner.pauseDailyTask}
              removeDailyTask={planner.removeDailyTask}
            />
          ) : null}

          {isMobile && mainView === "backlog" ? (
            <BacklogPanel
              backlog={planner.backlog}
              taskCategories={planner.taskCategories}
              toggleDone={planner.toggleDone}
              sendTaskToBacklog={planner.sendTaskToBacklog}
              moveTaskToWeek={planner.moveTaskToWeek}
              removeTask={planner.removeTask}
              onMove={(task) => setMoveTarget({ kind: "task", record: task })}
              onEdit={setEditTask}
              now={planner.today}
            />
          ) : null}
        </main>

        {isMobile ? (
          <MobileNav
            view={mainView}
            composeOpen={composeOpen}
            onChange={(next) => {
              setMainView(next);
              setComposeOpen(false);
            }}
            onAdd={() => {
              setComposeOpen((open) => {
                const next = !open;
                if (next) planner.setSidebarMode("task");
                return next;
              });
            }}
          />
        ) : null}
      </div>

      <DragOverlay>
        {overlayRecord && activeDrag?.kind === "event" ? (
          <EventCard event={overlayRecord} eventCategories={planner.eventCategories} surface="overlay" draggable={false} />
        ) : overlayRecord ? (
          <TaskCard
            task={overlayRecord}
            taskCategories={planner.taskCategories}
            onDone={activeDrag?.kind === "routine" ? planner.toggleDailyTaskDone : planner.toggleDone}
            onBacklog={planner.sendTaskToBacklog}
            onMoveToWeek={planner.moveTaskToWeek}
            onDelete={activeDrag?.kind === "routine" ? planner.removeDailyTask : planner.removeTask}
            compact
            hideWeekAction={activeDrag?.kind === "routine"}
            now={planner.today}
          />
        ) : null}
      </DragOverlay>

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          updateUserSettings={planner.updateUserSettings}
          userSettings={planner.data.userSettings}
          effectiveTheme={planner.theme}
        />
      )}

      {moveTarget ? (
        <MoveDialog
          task={moveTarget.kind === "task" ? moveTarget.record : null}
          event={moveTarget.kind === "event" ? moveTarget.record : null}
          activeWeekKey={planner.activeWeekKey}
          planner={planner}
          onUpdateEvent={planner.updateEvent}
          onPlaceTask={planner.placeTask}
          onClose={() => setMoveTarget(null)}
        />
      ) : null}

      {editTask ? (
        <TaskEditDialog
          task={editTask}
          planner={planner}
          taskCategories={planner.taskCategories}
          onSave={planner.updateTask}
          onClose={() => setEditTask(null)}
        />
      ) : null}

      {editEvent ? (
        <EventEditDialog
          event={editEvent}
          planner={planner}
          eventCategories={planner.eventCategories}
          onSave={planner.updateEvent}
          onClose={() => setEditEvent(null)}
        />
      ) : null}
    </DndContext>
    </div>
    </>
  );
}

export default App;
