import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import PlannerStatus from "./PlannerStatus";

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export default function Modal({ title, onClose, children, footer, planner }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    const root = dialogRef.current;
    const focusables = [...root.querySelectorAll(FOCUSABLE)];
    (focusables[0] ?? root).focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      const focusables = [...root.querySelectorAll(FOCUSABLE)];
      if (event.key !== "Tab" || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previous && typeof previous.focus === "function") previous.focus();
    };
  }, []);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="app-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="ghost-btn" onClick={onClose} aria-label="Cancel">
            Cancel
          </button>
        </div>
        <div className="app-modal-body">
          {planner && ["error", "locked", "conflict", "offline"].includes(planner.status) ? <PlannerStatus planner={planner} /> : null}
          {children}
        </div>
        {footer ? <div className="app-modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
