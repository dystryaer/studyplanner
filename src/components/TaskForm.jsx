import { useEffect, useState } from "react";

export default function TaskForm({ addTask, taskCategories = [] }) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(
    () => taskCategories[0]?.id ?? ""
  );
  const [due, setDue] = useState("");
  const [titleError, setTitleError] = useState("");

  useEffect(() => {
    setCategoryId((current) => {
      if (taskCategories.some((category) => category.id === current)) {
        return current;
      }
      return taskCategories[0]?.id ?? "";
    });
  }, [taskCategories]);

  function handleSubmit(e) {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError("A name is required.");
      return;
    }

    setTitleError("");
    const saved = addTask({
      title: trimmedTitle,
      categoryId,
      due: due || null,
    });

    if (saved) {
      setTitle("");
      setDue("");
    }
  }

  return (
    <section className="panel">
      <div className="sidebar-new">Create Task</div>

      <form className="form-field" onSubmit={handleSubmit}>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);

            if (e.target.value.trim()) {
              setTitleError("");
            }
          }}
          placeholder="study math Ch.2"
          aria-invalid={titleError ? "true" : "false"}
          aria-describedby={titleError ? "task-title-error" : undefined}
        />

        {titleError && (
          <p id="task-title-error" className="form-error" role="alert">
            {titleError}
          </p>
        )}

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {taskCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          lang="en-GB"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          placeholder="Due date (optional)"
        />

        <button type="submit">Save</button>
      </form>
    </section>
  );
}
