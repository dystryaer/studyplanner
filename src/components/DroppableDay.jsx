import { useDroppable } from "@dnd-kit/core";

export default function DroppableDay({
  id,
  date,
  className = "",
  as = "div",
  destType = "day",
  children,
  ...props
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { destType, date },
  });
  const Tag = as;
  return (
    <Tag
      ref={setNodeRef}
      className={`${className} ${isOver ? "is-drop-over" : ""}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
