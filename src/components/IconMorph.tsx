/* Hallmark · component: icon · genre: modern-minimal · theme: custom
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

import React, { useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

export type IconMorphType = 'play-pause' | 'volume' | 'fullscreen';

export interface IconMorphProps {
  type: IconMorphType;
  /** Active state flag (e.g. isPlaying, isMuted, isFullscreen) */
  active: boolean;
  size?: number;
  className?: string;
  ariaLabel?: string;
}

export const IconMorph: React.FC<IconMorphProps> = ({
  type,
  active,
  size = 18,
  className = '',
  ariaLabel,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 300);
    return () => clearTimeout(timer);
  }, [active]);

  const renderIcon = () => {
    switch (type) {
      case 'play-pause':
        return active ? (
          <Pause size={size} fill="currentColor" />
        ) : (
          <Play size={size} fill="currentColor" className="ml-0.5" />
        );
      case 'volume':
        return active ? (
          <VolumeX size={size} className="text-red-400" />
        ) : (
          <Volume2 size={size} />
        );
      case 'fullscreen':
        return active ? <Minimize size={size} /> : <Maximize size={size} />;
      default:
        return null;
    }
  };

  return (
    <span
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center transition-all duration-300 transform ${
        isAnimating ? 'scale-125 rotate-12' : 'scale-100 rotate-0'
      } ${className}`}
    >
      {renderIcon()}
    </span>
  );
};

export default IconMorph;
