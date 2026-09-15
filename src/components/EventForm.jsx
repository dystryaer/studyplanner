import { useEffect, useState } from "react";

export default function EventForm({ addEvent, eventCategories = [] }) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(
    () => eventCategories[0]?.id ?? ""
  );
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [titleError, setTitleError] = useState("");
  const [dateError, setDateError] = useState("");

  useEffect(() => {
    setCategoryId((current) => {
      if (eventCategories.some((category) => category.id === current)) {
        return current;
      }
      return eventCategories[0]?.id ?? "";
    });
  }, [eventCategories]);

  function handleSubmit(e) {
    e.preventDefault();

    const trimmedTitle = title.trim();
    let hasError = false;

    if (!trimmedTitle) {
      setTitleError("A name is required.");
      hasError = true;
    } else {
      setTitleError("");
    }

    if (!date) {
      setDateError("A date is required.");
      hasError = true;
    } else {
      setDateError("");
    }

    if (hasError) return;

    const saved = addEvent({
      title: trimmedTitle,
      categoryId,
      date,
      startTime,
      endTime,
    });

    if (saved) {
      setTitle("");
      setDate("");
    }
  }

  return (
    <section className="panel">
      <h2>Create Event</h2>

      <form className="form-field" onSubmit={handleSubmit}>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);

            if (e.target.value.trim()) {
              setTitleError("");
            }
          }}
          placeholder="exam"
          aria-invalid={titleError ? "true" : "false"}
          aria-describedby={titleError ? "event-title-error" : undefined}
        />

        {titleError && (
          <p id="event-title-error" className="form-error" role="alert">
            {titleError}
          </p>
        )}

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {eventCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);

            if (e.target.value) {
              setDateError("");
            }
          }}
          aria-invalid={dateError ? "true" : "false"}
          aria-describedby={dateError ? "event-date-error" : undefined}
        />

        {dateError && (
          <p id="event-date-error" className="form-error" role="alert">
            {dateError}
          </p>
        )}

        <div className="form-row">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>

        <button type="submit">Save</button>
      </form>
    </section>
  );
}
