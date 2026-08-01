/* Hallmark · component: skeleton · genre: modern-minimal · theme: custom
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

import React from 'react';

export interface SkeletonSwapProps {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SkeletonSwap: React.FC<SkeletonSwapProps> = ({
  loading,
  skeleton,
  children,
  className = '',
}) => {
  return (
    <div className={`relative ${className}`}>
      {loading ? (
        <div className="animate-fade-in transition-all duration-300">
          {skeleton}
        </div>
      ) : (
        <div className="animate-scale-in transition-all duration-300">
          {children}
        </div>
      )}
    </div>
  );
};

export default SkeletonSwap;
