import { useDroppable } from "@dnd-kit/core";

export default function DroppableTaskList({
  id,
  children,
  className = "",
  isEmpty = false,
  destType,
  categoryId,
  disabled = false,
  weekKey,
  date,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled,
    data: {
      destType,
      categoryId,
      weekKey,
      date,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? "is-drop-over" : ""} ${isEmpty ? "is-empty-list" : ""}`}
    >
      {children}
    </div>
  );
}
