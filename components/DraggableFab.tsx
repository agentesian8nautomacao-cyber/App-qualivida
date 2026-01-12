
import React, { useState, useRef, useEffect } from 'react';
import { PenTool } from 'lucide-react';

interface DraggableFabProps {
  onClick: () => void;
}

const DraggableFab: React.FC<DraggableFabProps> = ({ onClick }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !hasInitialized.current) {
      setPosition({ 
        x: window.innerWidth - 96,
        y: window.innerHeight - 96 
      });
      setIsVisible(true);
      hasInitialized.current = true;
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPosRef.current = { ...position };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      isDraggingRef.current = true;
      setPosition({
        x: initialPosRef.current.x + dx,
        y: initialPosRef.current.y + dy
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!isDraggingRef.current) onClick();
    isDraggingRef.current = false;
  };

  if (!isVisible) return null;

  return (
    <button 
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ left: position.x, top: position.y, position: 'fixed', touchAction: 'none' }}
      className="w-16 h-16 bg-white text-black rounded-full shadow-2xl flex items-center justify-center z-[100] hover:scale-110 active:scale-95 transition-transform cursor-move"
    >
      <PenTool className="w-6 h-6 pointer-events-none" />
    </button>
  );
};

export default DraggableFab;
