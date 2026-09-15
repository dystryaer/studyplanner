import { useState } from "react";
import Modal from "./Modal";

export default function MoveDialog({ task, event, activeWeekKey, onPlaceTask, onUpdateEvent, onClose, planner }) {
  const isEvent = Boolean(event);
  const [mode, setMode] = useState(task?.plannedSlot ? "day" : "week");
  const [weekKey, setWeekKey] = useState(task?.weekKey ?? activeWeekKey);
  const [date, setDate] = useState(task?.plannedSlot?.date ?? event?.date ?? "");
  const [startTime, setStartTime] = useState(task?.plannedSlot?.startTime ?? "");
  const [endTime, setEndTime] = useState(task?.plannedSlot?.endTime ?? "");
  const [error, setError] = useState("");

  function handleSubmit(submitEvent) {
    submitEvent.preventDefault();
    try {
      if (isEvent) {
        if (!date) throw new Error("A date is required.");
        const saved = onUpdateEvent(event.id, { date });
        if (saved) onClose();
        return;
      }
      let destination;
      if (mode === "backlog") destination = { kind: "backlog" };
      else if (mode === "week") destination = { kind: "week", weekKey };
      else {
        destination = {
          kind: "day",
          date,
          startTime,
          endTime,
        };
      }
      const saved = onPlaceTask(task.id, destination);
      if (saved) onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal
      title={isEvent ? "Move appointment" : "Move to"}
      onClose={onClose}
      planner={planner}
      footer={
        <>
          <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
          <button type="submit" form="move-form">Save</button>
        </>
      }
    >
      <form id="move-form" className="form-field" onSubmit={handleSubmit}>
        {isEvent ? (
          <label>
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        ) : (
          <>
            <label>
              <span>Destination</span>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="week">Week only</option>
                <option value="day">Day and optional time</option>
                <option value="backlog">Backlog</option>
              </select>
            </label>
            {mode === "week" ? (
              <label>
                <span>Week</span>
                <input type="week" value={weekKey} onChange={(e) => setWeekKey(e.target.value)} required />
              </label>
            ) : null}
            {mode === "day" ? (
              <>
                <label>
                  <span>Date</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </label>
                <label>
                  <span>Start time</span>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </label>
                <label>
                  <span>End time</span>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </label>
              </>
            ) : null}
          </>
        )}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>
    </Modal>
  );
}
