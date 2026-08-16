import React, { useRef, useState, useCallback, useEffect } from 'react';

interface SpotlightProps {
  className?: string;
  size?: number;
}

export const Spotlight: React.FC<SpotlightProps> = ({
  className = '',
  size = 300,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!containerRef.current || !containerRef.current.parentElement) return;
    const parent = containerRef.current.parentElement;
    const rect = parent.getBoundingClientRect();
    setPosition({
      x: event.clientX - rect.left - size / 2,
      y: event.clientY - rect.top - size / 2,
    });
  }, [size]);

  useEffect(() => {
    const parent = containerRef.current?.parentElement;
    if (!parent) return;

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    parent.addEventListener('mousemove', handleMouseMove);
    parent.addEventListener('mouseenter', handleMouseEnter);
    parent.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      parent.removeEventListener('mousemove', handleMouseMove);
      parent.removeEventListener('mouseenter', handleMouseEnter);
      parent.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove]);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute rounded-full transition-opacity duration-300 ${
        isHovered ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        background: `radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 50%, transparent 80%)`,
        filter: 'blur(16px)',
        zIndex: 1,
      }}
    />
  );
};
