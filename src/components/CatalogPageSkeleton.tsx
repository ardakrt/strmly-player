/* Hallmark · component: skeleton · genre: modern-minimal · theme: custom
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

import React from 'react';

export const CatalogPageSkeleton: React.FC = () => {
  return (
    <div className="series-catalog-shell grid h-full min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden md:grid-cols-[218px_minmax(0,1fr)] md:grid-rows-1 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-3 animate-fade-in select-none">
      {/* Sidebar Rail Skeleton */}
      <aside className="series-catalog-panel series-category-panel flex min-h-0 max-h-[36vh] flex-col gap-2 overflow-y-auto rounded-2xl border border-white/[0.06] p-3 hide-scrollbar md:max-h-none">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <div className="h-3 w-20 rounded bg-white/[0.08] skeleton-card-shimmer" />
          <div className="h-4 w-8 rounded bg-white/[0.05] skeleton-card-shimmer" />
        </div>
        <div className="h-8 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] skeleton-card-shimmer mb-1" />

        <div className="h-8 w-full rounded-lg bg-white/[0.08] skeleton-card-shimmer" />
        <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-white/[0.05]">
          <div className="h-3 w-16 rounded bg-white/[0.05] skeleton-card-shimmer mb-1" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={`skel-cat-${i}`}
              className="h-7 w-full rounded-lg bg-white/[0.035] skeleton-card-shimmer"
              style={{ animationDelay: `${i * 45}ms` }}
            />
          ))}
        </div>
      </aside>

      {/* Main Catalog Stage Skeleton */}
      <section className="series-catalog-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/[0.07]">
        {/* Header Skeleton */}
        <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3.5 lg:px-6">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="h-3 w-16 rounded bg-white/[0.06] skeleton-card-shimmer" />
            <div className="h-5 w-40 rounded-md bg-white/[0.09] skeleton-card-shimmer" />
          </div>
          <div className="h-7 w-20 rounded-full border border-white/[0.07] bg-white/[0.04] skeleton-card-shimmer" />
        </header>

        {/* Grid Skeleton Matrix */}
        <div className="min-h-0 flex-1 overflow-hidden px-4 pb-8 pt-4 lg:px-5 lg:pt-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
            {Array.from({ length: 21 }).map((_, i) => (
              <div
                key={`skel-card-${i}`}
                className="flex flex-col gap-2.5 animate-card-cascade"
                style={{ animationDelay: `${i * 25}ms` }}
              >
                <div className="relative aspect-[2/3] w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] skeleton-card-shimmer overflow-hidden shadow-lg" />
                <div className="h-3.5 w-3/4 rounded bg-white/[0.06] skeleton-card-shimmer mt-1" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default CatalogPageSkeleton;
