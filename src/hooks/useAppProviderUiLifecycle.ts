import { useCallback, useEffect, useState } from "react";

interface UseAppProviderUiLifecycleOptions {
  selectedGroup: string;
  searchQuery: string;
  activePlaylistId: string;
  activeLiveCategory: string;
  activeMovieCategory: string;
  activeSeriesCategory: string;
  setVisibleCount: (count: number) => void;
  setSortOption: (option: "default") => void;
  setQualityFilter: (filter: "all") => void;
  setScrolled: (updater: (previous: boolean) => boolean) => void;
  loaded: boolean;
  isSeriesReady: boolean;
  isHomeReady: boolean;
}

export function useAppProviderUiLifecycle({
  selectedGroup,
  searchQuery,
  activePlaylistId,
  activeLiveCategory,
  activeMovieCategory,
  activeSeriesCategory,
  setVisibleCount,
  setSortOption,
  setQualityFilter,
  setScrolled,
  loaded,
  isSeriesReady,
  isHomeReady,
}: UseAppProviderUiLifecycleOptions) {
  const [hasInitialBooted, setHasInitialBooted] = useState(false);

  useEffect(() => {
    setVisibleCount(100);
  }, [selectedGroup, searchQuery, activePlaylistId, setVisibleCount]);

  useEffect(() => {
    setSortOption("default");
    setQualityFilter("all");
  }, [
    selectedGroup,
    activeLiveCategory,
    activeMovieCategory,
    activeSeriesCategory,
    activePlaylistId,
    setSortOption,
    setQualityFilter,
  ]);

  useEffect(() => {
    if (loaded && isSeriesReady && isHomeReady) setHasInitialBooted(true);
  }, [loaded, isSeriesReady, isHomeReady]);

  const handleMainScroll = useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      const isScrolled = event.currentTarget.scrollTop > 10;
      setScrolled((previous) =>
        previous !== isScrolled ? isScrolled : previous,
      );
    },
    [setScrolled],
  );

  const handleScrollSlider = useCallback(
    (sliderId: string, direction: "left" | "right") => {
      const element = document.getElementById(sliderId);
      if (!element) return;
      const multiplier = direction === "left" ? -0.75 : 0.75;
      element.scrollBy({
        left: element.clientWidth * multiplier,
        behavior: "smooth",
      });
    },
    [],
  );

  return {
    hasInitialBooted,
    isAppReady: loaded && isSeriesReady && isHomeReady,
    handleMainScroll,
    handleScrollSlider,
  };
}
