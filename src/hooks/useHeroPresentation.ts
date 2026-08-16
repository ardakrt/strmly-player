import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { HERO_BACKDROPS } from "../constants";
import { APP_VIEWS } from "../navigation/views";
import type { PlaylistItem } from "../types";
import type { FeaturedTmdbData } from "./homeDataTypes";
import {
  extractColorsFromImage,
  getHashColors,
  type AmbientColors,
} from "../utils/themeExtractor";

interface UseHeroPresentationOptions {
  showcaseItems: PlaylistItem[];
  featuredTmdbData: FeaturedTmdbData | null;
  activeFeaturedIndex: number;
  displayFeaturedIndex: number;
  setActiveFeaturedIndex: Dispatch<SetStateAction<number>>;
  selectedGroup: string;
}

export function useHeroPresentation({
  showcaseItems,
  featuredTmdbData,
  activeFeaturedIndex,
  displayFeaturedIndex,
  setActiveFeaturedIndex,
  selectedGroup,
}: UseHeroPresentationOptions) {
  const isPlaylistHero = showcaseItems.length > 0;
  const activeShowcaseList = isPlaylistHero ? showcaseItems : HERO_BACKDROPS;
  const currentHeroItem = useMemo(
    () =>
      isPlaylistHero
        ? (showcaseItems[displayFeaturedIndex] as PlaylistItem)
        : null,
    [isPlaylistHero, showcaseItems, displayFeaturedIndex],
  );
  const fallbackHeroItem = useMemo(
    () => (!isPlaylistHero ? HERO_BACKDROPS[displayFeaturedIndex] : null),
    [isPlaylistHero, displayFeaturedIndex],
  );
  const [heroAmbientColors, setHeroAmbientColors] = useState<AmbientColors>(() =>
    getHashColors("Strmly"),
  );

  useEffect(() => {
    const activeItemName = currentHeroItem
      ? currentHeroItem.name
      : fallbackHeroItem
        ? fallbackHeroItem.title
        : "Strmly";
    const backdropUrl = currentHeroItem
      ? featuredTmdbData?.backdrop || currentHeroItem.logo
      : fallbackHeroItem?.img;
    if (!backdropUrl) {
      setHeroAmbientColors(getHashColors(activeItemName));
      return;
    }

    let active = true;
    void extractColorsFromImage(backdropUrl).then((colors) => {
      if (active && colors) setHeroAmbientColors(colors);
    });
    return () => {
      active = false;
    };
  }, [currentHeroItem, fallbackHeroItem, featuredTmdbData]);

  useEffect(() => {
    if (selectedGroup !== APP_VIEWS.home) return;
    const maxItems = isPlaylistHero
      ? showcaseItems.length
      : HERO_BACKDROPS.length;
    if (maxItems <= 1) return;
    const timer = window.setInterval(() => {
      setActiveFeaturedIndex((previous) => (previous + 1) % maxItems);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [
    selectedGroup,
    showcaseItems.length,
    activeFeaturedIndex,
    isPlaylistHero,
    setActiveFeaturedIndex,
  ]);

  return {
    activeShowcaseList,
    isPlaylistHero,
    currentHeroItem,
    fallbackHeroItem,
    heroAmbientColors,
  };
}
