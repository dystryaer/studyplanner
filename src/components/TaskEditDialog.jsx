import { useState } from "react";
import Modal from "./Modal";

export default function TaskEditDialog({ task, taskCategories, onSave, onClose, planner }) {
  const [title, setTitle] = useState(task.title);
  const [categoryId, setCategoryId] = useState(task.categoryId ?? taskCategories[0]?.id ?? "");
  const [due, setDue] = useState(task.due ?? "");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("A name is required.");
      return;
    }
    const saved = onSave(task.id, { title: trimmed, categoryId, due: due || null });
    if (saved) onClose();
  }

  return (
    <Modal
      title="Edit task"
      onClose={onClose}
      planner={planner}
      footer={
        <>
          <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
          <button type="submit" form="task-edit-form">Save</button>
        </>
      }
    >
      <form id="task-edit-form" className="form-field" onSubmit={handleSubmit}>
        <label>
          <span>Name</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          <span>Category</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {taskCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Due date (optional)</span>
          <input type="date" lang="en-GB" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>
    </Modal>
  );
}
