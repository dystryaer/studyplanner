import { useState } from "react";
import { normalizeClockTime } from "../domain/plannerState.js";
import Modal from "./Modal";

export default function EventEditDialog({ event, eventCategories, onSave, onClose, planner }) {
  const [title, setTitle] = useState(event.title);
  const [categoryId, setCategoryId] = useState(event.categoryId ?? eventCategories[0]?.id ?? "");
  const [date, setDate] = useState(event.date ?? "");
  const [startTime, setStartTime] = useState(event.startTime ?? "");
  const [endTime, setEndTime] = useState(event.endTime ?? "");
  const [error, setError] = useState("");

  function handleSubmit(submitEvent) {
    submitEvent.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("A name is required.");
      return;
    }
    if (!date) {
      setError("A date is required.");
      return;
    }
    try {
      const start = normalizeClockTime(startTime);
      const end = normalizeClockTime(endTime);
      if (end && !start) throw new Error("An end time requires a start time");
      if (start && end && end <= start) throw new Error("End time must be after start time");
      const saved = onSave(event.id, { title: trimmed, categoryId, date, startTime: start, endTime: end });
      if (saved) onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal
      title="Edit appointment"
      onClose={onClose}
      planner={planner}
      footer={
        <>
          <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
          <button type="submit" form="event-edit-form">Save</button>
        </>
      }
    >
      <form id="event-edit-form" className="form-field" onSubmit={handleSubmit}>
        <label>
          <span>Name</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          <span>Category</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {eventCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          <span>Start time</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label>
          <span>End time</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>
    </Modal>
  );
}
