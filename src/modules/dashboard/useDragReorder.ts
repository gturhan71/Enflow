import { useState } from 'react';

// Native HTML5 drag-and-drop ile liste sıralama — motion paketinde Reorder
// bileşeni yok (framer-motion'da var, motion'da yok), bu yüzden dependency-free.
export function useDragReorder<T>(items: T[], setItems: (next: T[]) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const onDragStart = (index: number) => setDragIndex(index);
  const onDragOver = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setItems(next);
    setDragIndex(index);
  };
  const onDragEnd = () => setDragIndex(null);

  return { dragIndex, onDragStart, onDragOver, onDragEnd };
}
