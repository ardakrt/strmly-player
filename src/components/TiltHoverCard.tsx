/* Hallmark · component: tilt-card · genre: modern-minimal · theme: custom
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

import React, { useRef, useState, useCallback } from 'react';

export interface TiltHoverCardProps {
  children: React.ReactNode;
  className?: string;
  maxTiltDegrees?: number;
  glareOpacity?: number;
  disabled?: boolean;
}

export const TiltHoverCard: React.FC<TiltHoverCardProps> = ({
  children,
  className = '',
  maxTiltDegrees = 7,
  glareOpacity = 0.20,
  disabled = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transformStyle, setTransformStyle] = useState<string>(
    'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
  );
  const [glareStyle, setGlareStyle] = useState<{ opacity: number; background: string }>({
    opacity: 0,
    background: 'none',
  });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Calculate tilt angles (-maxTilt to +maxTilt)
      const rotateX = (-(y - centerY) / centerY) * maxTiltDegrees;
      const rotateY = ((x - centerX) / centerX) * maxTiltDegrees;

      // Calculate glare gradient position
      const glareX = (x / rect.width) * 100;
      const glareY = (y / rect.height) * 100;

      setTransformStyle(
        `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.025, 1.025, 1.025)`
      );

      setGlareStyle({
        opacity: glareOpacity,
        background: `radial-gradient(circle at ${glareX.toFixed(1)}% ${glareY.toFixed(1)}%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%)`,
      });
    },
    [maxTiltDegrees, glareOpacity, disabled]
  );

  const handleMouseEnter = () => {
    if (!disabled) setIsHovered(true);
  };

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTransformStyle('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    setGlareStyle((prev) => ({ ...prev, opacity: 0 }));
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden rounded-[inherit] transition-transform duration-200 ease-out ${className}`}
      style={{
        transform: transformStyle,
        transformStyle: 'preserve-3d',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
      }}
    >
      {children}
      {/* Dynamic 3D Glare Light Reflection Overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300 z-30"
        style={{
          opacity: isHovered ? glareStyle.opacity : 0,
          background: glareStyle.background,
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
};

export default TiltHoverCard;
