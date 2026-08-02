import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import React, { type ReactNode } from "react";

export function moveImageId(ids: Array<string | number>, activeId: string | number, overId: string | number) {
  const oldIndex = ids.indexOf(activeId);
  const newIndex = ids.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return ids;
  return arrayMove(ids, oldIndex, newIndex);
}

function SortableImageItem({
  id,
  disabled,
  children,
}: {
  id: string | number;
  disabled: boolean;
  children: (dragHandle: ReactNode, isDragging: boolean) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-20 scale-[1.02] opacity-70 shadow-xl" : undefined}
    >
      {children(
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          aria-label="按住並拖曳調整圖片順序"
          title="桌機按住拖曳；手機長按後拖曳"
          className="touch-none rounded-lg border border-stone-200 bg-white/95 p-2 text-stone-500 shadow-sm transition-colors hover:border-orange-300 hover:text-orange-700 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
        >
          <GripVertical className="size-4" />
        </button>,
        isDragging,
      )}
    </div>
  );
}

export function SortableImageGrid({
  ids,
  disabled = false,
  className,
  onReorder,
  children,
}: {
  ids: Array<string | number>;
  disabled?: boolean;
  className: string;
  onReorder: (ids: Array<string | number>) => void;
  children: (id: string | number, dragHandle: ReactNode, isDragging: boolean) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(moveImageId(ids, active.id, over.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={className}>
          {ids.map(id => (
            <SortableImageItem key={id} id={id} disabled={disabled}>
              {(dragHandle, isDragging) => children(id, dragHandle, isDragging)}
            </SortableImageItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
