import { BacklogIcon, EventTabIcon, PlusIcon, RepeatIcon, TaskTabIcon } from "./Icons";

const items = [
  { id: "week", label: "Week", icon: TaskTabIcon },
  { id: "routines", label: "Routines", icon: RepeatIcon },
  { id: "calendar", label: "Calendar", icon: EventTabIcon },
  { id: "backlog", label: "Backlog", icon: BacklogIcon },
];

export default function MobileNav({ view, onChange, onAdd, composeOpen }) {
  return (
    <nav className="mobile-nav" aria-label="Planner sections">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? "is-active" : ""}
            aria-current={view === item.id ? "page" : undefined}
            onClick={() => onChange(item.id)}
          >
            <Icon />
            <span>{item.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        className={composeOpen ? "is-active" : ""}
        aria-pressed={composeOpen}
        onClick={onAdd}
      >
        <PlusIcon />
        <span>Add</span>
      </button>
    </nav>
  );
}
