import { useEffect, useState } from "react";

export default function DailyTaskForm({ addDailyTask, taskCategories = [] }) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(
    () => taskCategories[0]?.id ?? ""
  );
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
    const saved = addDailyTask({
      title: trimmedTitle,
      categoryId,
    });

    if (saved) {
      setTitle("");
    }
  }

  return (
    <section className="panel">
      <div className="sidebar-new">Create Daily Task</div>

      <form className="form-field" onSubmit={handleSubmit}>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);

            if (e.target.value.trim()) {
              setTitleError("");
            }
          }}
          placeholder="Anki Cards"
          aria-invalid={titleError ? "true" : "false"}
          aria-describedby={titleError ? "daily-title-error" : undefined}
        />

        {titleError && (
          <p id="daily-title-error" className="form-error" role="alert">
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

        <button type="submit">Save</button>
      </form>
    </section>
  );
}
