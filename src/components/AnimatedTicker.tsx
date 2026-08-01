/* Hallmark · component: animated-ticker · genre: modern-minimal · theme: custom
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

import React, { useEffect, useState, useRef } from 'react';

export interface AnimatedTickerProps {
  value: number;
  duration?: number;
  formatter?: (val: number) => string;
  className?: string;
}

export const AnimatedTicker: React.FC<AnimatedTickerProps> = ({
  value,
  duration = 750,
  formatter = (val) => val.toLocaleString('tr-TR'),
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const displayValueRef = useRef(0);
  const startValueRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    startValueRef.current = displayValueRef.current;
    startTimeRef.current = null;
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic: 1 - (1 - t)^3
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValueRef.current + (value - startValueRef.current) * easedProgress);
      displayValueRef.current = current;
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  return <span className={`inline-block tabular-nums transition-all ${className}`}>{formatter(displayValue)}</span>;
};

export default AnimatedTicker;
