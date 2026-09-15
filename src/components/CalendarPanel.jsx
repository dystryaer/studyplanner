import { useEffect, useMemo, useState } from "react";
import {
  toDateKey,
  formatSelectedDate,
  formatDueDate,
  parseLocalDate,
  formatWeekdayShort,
} from "../utils/date";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  TodayIcon,
  CloseIcon,
} from "./Icons";
import { mixHex, getReadableTextColor } from "../utils/color";
import { defaultEventCategories } from "../data/defaultCategories";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatEventRangeLabel(start, end) {
  return `${formatDueDate(toDateKey(start))} - ${formatDueDate(toDateKey(end))}`;
}

export default function CalendarPanel({
  calendarMonthLabel,
  calendarDays,
  selectedDate,
  selectedDateKey,
  selectedDateEvents,
  eventDates,
  eventCategories = [],
  setCalendarDate,
  setSelectedDate,
  removeEvent,
  allEvents = [],
  weekRange,
  activeWeekDate,
  setWeekOffset,
}) {
  const [rangeStart, setRangeStart] = useState(
    weekRange?.start ? toDateKey(weekRange.start) : toDateKey(new Date())
  );
  const [rangeEnd, setRangeEnd] = useState(
    weekRange?.end ? toDateKey(weekRange.end) : toDateKey(new Date())
  );

  useEffect(() => {
    if (!weekRange?.start || !weekRange?.end) return;
    setRangeStart(toDateKey(weekRange.start));
    setRangeEnd(toDateKey(weekRange.end));
  }, [activeWeekDate, weekRange]);

  function goToPreviousMonth() {
    setCalendarDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  }

  function goToNextMonth() {
    setCalendarDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  }

  function goToToday() {
    const today = new Date();
    setCalendarDate(today);
    setSelectedDate(today);
  }

  function resetRangeToCurrentWeek() {
    if (typeof setWeekOffset === "function") {
      setWeekOffset(0);
    }

    if (weekRange?.start && weekRange?.end) {
      setRangeStart(toDateKey(weekRange.start));
      setRangeEnd(toDateKey(weekRange.end));
    }
  }

  const normalizedRange = useMemo(() => {
    if (!rangeStart || !rangeEnd) return null;

    const start = parseLocalDate(rangeStart);
    const end = parseLocalDate(rangeEnd);

    if (start > end) {
      return { start: end, end: start };
    }

    return { start, end };
  }, [rangeStart, rangeEnd]);

  const rangeEvents = useMemo(() => {
    if (!normalizedRange) return [];

    return allEvents
      .filter((event) => {
        const eventDate = parseLocalDate(event.date);
        return eventDate >= normalizedRange.start && eventDate <= normalizedRange.end;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.startTime ?? "").localeCompare(b.startTime ?? "");
      });
  }, [allEvents, normalizedRange]);

  function renderEventCard(event, showDate = false) {
    const category =
      eventCategories.find((item) => item.id === event.categoryId) ||
      defaultEventCategories.find((item) => item.id === event.categoryId);

    const categoryLabel = category?.label ?? "Other";
    const baseColor = category?.baseColor ?? "#ffeedb";
    const cardBg = mixHex(baseColor, "#fbfbf8", 0.88);
    const cardBorder = mixHex(baseColor, "#d4d1ca", 0.45);
    const cardText = getReadableTextColor(cardBg);

    return (
      <article
        key={event.id}
        className={`event-card ${event.categoryId ?? "other"}`}
        role="group"
        aria-label={event.title}
        style={{
          background: cardBg,
          borderColor: cardBorder,
          color: cardText,
        }}
      >
        <div className="event-card-top">
          <strong>{event.title}</strong>

          <button
            type="button"
            onClick={() => removeEvent(event.id)}
            aria-label="Delete Event"
            title="Delete Event"
          >
            <CloseIcon />
          </button>
        </div>

        <p>
          {showDate ? `${formatWeekdayShort(event.date)} · ${formatDueDate(event.date)} · ` : ""}
          {event.startTime} - {event.endTime} · {categoryLabel}
        </p>
      </article>
    );
  }

  function getMonthLabel(dateString) {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  }

  return (
    <aside className="panel calendar-panel">
      <div className="calendar-header">
        <h3>{calendarMonthLabel}</h3>

        <div className="calendar-header-actions">
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={goToPreviousMonth}
            aria-label="Last Month"
            title="Last Month"
          >
            <ChevronLeftIcon />
          </button>

          <button
            type="button"
            className="calendar-today-btn"
            onClick={goToToday}
            aria-label="Today"
            title="Today"
          >
            <TodayIcon />
          </button>

          <button
            type="button"
            className="calendar-nav-btn"
            onClick={goToNextMonth}
            aria-label="Next Month"
            title="Next Month"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className="calendar-weekdays" role="row">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="calendar-grid" aria-label="Monthly Calendar">
        {calendarDays.map((day) => {
          const dateKey = toDateKey(day.date);
          const isCurrentMonth = day.isCurrentMonth;
          const isSelected = dateKey === selectedDateKey;
          const isToday = dateKey === toDateKey(new Date());
          const hasEvents = eventDates.has(dateKey);

          return (
            <button
              key={dateKey}
              type="button"
              className={[
                "calendar-day-btn",
                !isCurrentMonth ? "is-muted" : "",
                isSelected ? "is-selected" : "",
                isToday ? "is-today" : "",
                hasEvents ? "has-events" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                setSelectedDate(new Date(day.date));

                if (!isCurrentMonth) {
                  setCalendarDate(
                    new Date(day.date.getFullYear(), day.date.getMonth(), 1)
                  );
                }
              }}
              aria-pressed={isSelected}
              aria-label={`Day ${day.date.getDate()}${
                hasEvents ? ", with events" : ""
              }`}
            >
              <span className="calendar-day-number">{day.date.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="calendar-details" aria-live="polite">
        <div className="calendar-details-head">
          <h3>{formatSelectedDate(selectedDate)}</h3>
          <span>{selectedDateEvents.length}</span>
        </div>

        {selectedDateEvents.length === 0 ? (
          <p className="empty-copy">No events on this day.</p>
        ) : (
          <div className="event-list">
            {selectedDateEvents.map((event) => renderEventCard(event))}
          </div>
        )}
      </div>

      <div className="calendar-range-section" aria-live="polite">
        <div className="calendar-event-timeline">
          <h3>Event Timeline</h3>
          <span>{rangeEvents.length}</span>
        </div>

        <div className="calendar-range-controls">
          <label className="calendar-range-field">
            <span>Start</span>
            <input
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
            />
          </label>

          <label className="calendar-range-field">
            <span>End</span>
            <input
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
            />
          </label>

          <button
            type="button"
            className="calendar-range-reset-btn"
            onClick={resetRangeToCurrentWeek}
          >
            Current week
          </button>
        </div>

        {rangeEvents.length === 0 ? (
          <p className="empty-copy">No events in this range.</p>
        ) : (
          <div className="event-list">
            {rangeEvents.map((event, index) => {
              const currentMonth = getMonthLabel(event.date);
              const previousMonth =
                index > 0 ? getMonthLabel(rangeEvents[index - 1].date) : null;

              const showMonthDivider = index === 0 || currentMonth !== previousMonth;

              const category =
                eventCategories.find((item) => item.id === event.categoryId) ||
                defaultEventCategories.find((item) => item.id === event.categoryId);

              const categoryLabel = category?.label ?? "Other";
              const baseColor = category?.baseColor ?? "#ffeedb";
              const cardBg = mixHex(baseColor, "#fbfbf8", 0.88);
              const cardBorder = mixHex(baseColor, "#d4d1ca", 0.45);
              const cardText = getReadableTextColor(cardBg);

              return (
                <div key={event.id} className="event-list-group">
                  {showMonthDivider && (
                    <div className="event-month-divider">
                      <span>{currentMonth}</span>
                    </div>
                  )}

                  <article
                    className={`event-card ${event.categoryId ?? "other"}`}
                    role="group"
                    aria-label={event.title}
                    style={{
                      background: cardBg,
                      borderColor: cardBorder,
                      color: cardText,
                    }}
                  >
                    <div className="event-card-top">
                      <strong>{event.title}</strong>

                      <button
                        type="button"
                        onClick={() => removeEvent(event.id)}
                        aria-label="Delete Event"
                        title="Delete Event"
                      >
                        <CloseIcon />
                      </button>
                    </div>

                    <p>
                      {formatWeekdayShort(event.date)} · {formatDueDate(event.date)}
                       · {event.startTime} - {event.endTime} ·{" "}{categoryLabel}
                    </p>
                  </article>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}