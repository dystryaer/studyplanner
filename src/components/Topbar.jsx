import { getWeekNumber } from "../utils/date";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  TodayIcon,
  SettingsIcon,
  LogoutIcon,
} from "./Icons";

export default function Topbar({
  weekLabel,
  plannedWeekTasksCount,
  doneWeekTasksCount,
  weekEventsCount,
  goToPreviousWeek,
  goToCurrentWeek,
  goToNextWeek,
  activeWeekDate,
  onOpenSettings,
  authUser,
  onLogout,
  mainView,
  onMainViewChange,
  showViewSwitch = false,
}) {
  function Stat({ label, value }) {
    return (
      <article className="stat-card">
        <span>{label}</span>
        <strong>{value}</strong>
      </article>
    );
  }

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-week">
          <h2>Week {getWeekNumber(activeWeekDate)}</h2>
          <p className="week-label">{weekLabel}</p>
        </div>

        {showViewSwitch ? (
          <div className="view-switch" role="tablist" aria-label="Main views">
            <button type="button" className={mainView === "week" ? "is-active" : ""} onClick={() => onMainViewChange("week")}>Week</button>
            <button type="button" className={mainView === "calendar" ? "is-active" : ""} onClick={() => onMainViewChange("calendar")}>Calendar</button>
          </div>
        ) : null}

        <div className="week-actions">
          <button
            type="button"
            className="week-nav-btn icon-only"
            onClick={goToPreviousWeek}
            aria-label="Last Week"
            title="Last Week"
          >
            <ChevronLeftIcon />
          </button>

          <button
            type="button"
            className="week-nav-btn icon-only"
            onClick={goToCurrentWeek}
            aria-label="This Week"
            title="This Week"
          >
            <TodayIcon />
          </button>

          <button
            type="button"
            className="week-nav-btn icon-only"
            onClick={goToNextWeek}
            aria-label="Next Week"
            title="Next Week"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className="topbar-right">
        <div className="topbar-right stats">
          <Stat label="Planned" value={plannedWeekTasksCount} />
          <Stat label="Done" value={doneWeekTasksCount} />
          <Stat label="Events" value={weekEventsCount} />
        </div>

        <div className="topbar-right set-log">
          {authUser && (
            <>
              <div className="topbar-account">
                <span className="topbar-account-email">{authUser.email}</span>
              </div>

              <button
                type="button"
                className="week-nav-btn icon-only"
                onClick={onLogout}
                aria-label="Logout"
                title="Logout"
              >
                <LogoutIcon />
              </button>
            </>
          )}

          <button
            type="button"
            className="week-nav-btn icon-only"
            onClick={onOpenSettings}
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon />
          </button>
        </div>
      </div>
    </div>
  );
}