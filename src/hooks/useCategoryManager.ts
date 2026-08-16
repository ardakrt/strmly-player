import { useMemo, useCallback } from 'react';

type Domain = 'live' | 'series' | 'movie';

interface UseCategoryManagerOptions {
  domain: Domain;
  language: 'tr' | 'en';
  uniqueCategories: string[];
  categorySearchQuery: string;
  saveAppSetting: (key: string, value: unknown) => Promise<void>;
  showToast: (message: string) => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  // State and setters owned by the caller (App.tsx)
  favorites: string[];
  setFavorites: React.Dispatch<React.SetStateAction<string[]>>;
  customOrder: string[];
  setCustomOrder: React.Dispatch<React.SetStateAction<string[]>>;
  hidden: string[];
  setHidden: React.Dispatch<React.SetStateAction<string[]>>;
  editMode: boolean;
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  draggedCategory: string | null;
  setDraggedCategory: React.Dispatch<React.SetStateAction<string | null>>;
}

// Persistence key mapping — must match exactly with existing keys
const KEYS: Record<Domain, { favorites: string; customOrder: string; hidden: string }> = {
  live: {
    favorites: 'favorite_categories',
    customOrder: 'custom_category_order',
    hidden: 'hidden_categories',
  },
  series: {
    favorites: 'favorite_series_categories',
    customOrder: 'custom_series_category_order',
    hidden: 'hidden_series_categories',
  },
  movie: {
    favorites: 'favorite_movie_categories',
    customOrder: 'custom_movie_category_order',
    hidden: 'hidden_movie_categories',
  },
};

// Domain-specific toast labels
const LABELS: Record<Domain, { singular: string; plural: string }> = {
  live: { singular: 'kategorisi', plural: 'kategoriler' },
  series: { singular: 'dizi kategorisi', plural: 'dizi kategoriler' },
  movie: { singular: 'film kategorisi', plural: 'film kategoriler' },
};

// English variants of the same toast labels
const LABELS_EN: Record<Domain, { singular: string; plural: string }> = {
  live: { singular: 'category', plural: 'categories' },
  series: { singular: 'series category', plural: 'series categories' },
  movie: { singular: 'movie category', plural: 'movie categories' },
};

export function useCategoryManager(options: UseCategoryManagerOptions) {
  const {
    domain, language, uniqueCategories, categorySearchQuery, saveAppSetting, showToast,
    activeCategory, setActiveCategory,
    favorites, setFavorites, customOrder, setCustomOrder, hidden, setHidden,
    editMode, setEditMode, draggedCategory, setDraggedCategory,
  } = options;
  const keys = KEYS[domain];
  const labels = LABELS[domain];
  const labelsEn = LABELS_EN[domain];



  // Actions
  const toggleFavorite = useCallback((categoryName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let updated = [...favorites];
    if (updated.includes(categoryName)) {
      updated = updated.filter(c => c !== categoryName);
    } else {
      updated.push(categoryName);
    }
    setFavorites(updated);
    saveAppSetting(keys.favorites, updated);
  }, [favorites, keys.favorites, saveAppSetting, setFavorites]);

  const handleHide = useCallback((categoryName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = [...hidden, categoryName];
    setHidden(updated);
    saveAppSetting(keys.hidden, updated);
    showToast(language === 'tr' ? `"${categoryName}" ${labels.singular} gizlendi` : `"${categoryName}" ${labelsEn.singular} hidden`);
    if (activeCategory === categoryName) {
      setActiveCategory('Tümü');
    }
  }, [hidden, keys.hidden, saveAppSetting, showToast, labels.singular, labelsEn.singular, activeCategory, setActiveCategory, setHidden, language]);

  const handleRestore = useCallback((categoryName: string) => {
    const updated = hidden.filter(c => c !== categoryName);
    setHidden(updated);
    saveAppSetting(keys.hidden, updated);
    showToast(language === 'tr' ? `"${categoryName}" ${labels.singular} geri getirildi` : `"${categoryName}" ${labelsEn.singular} restored`);
  }, [hidden, keys.hidden, saveAppSetting, showToast, labels.singular, labelsEn.singular, setHidden, language]);

  const handleResetHidden = useCallback(() => {
    setHidden([]);
    saveAppSetting(keys.hidden, []);
    showToast(language === 'tr' ? `Tüm gizlenen ${labels.plural} geri getirildi` : `All hidden ${labelsEn.plural} restored`);
  }, [keys.hidden, saveAppSetting, showToast, labels.plural, labelsEn.plural, setHidden, language]);

  const handleDragStart = useCallback((e: React.DragEvent, category: string) => {
    if (!editMode) {
      e.preventDefault();
      return;
    }
    setDraggedCategory(category);
    e.dataTransfer.effectAllowed = 'move';
    const dragIcon = document.createElement('div');
    e.dataTransfer.setDragImage(dragIcon, 0, 0);
  }, [editMode, setDraggedCategory]);

  const handleDrop = useCallback((e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    if (!editMode || !draggedCategory || draggedCategory === targetCategory) return;

    const isDraggedFav = favorites.includes(draggedCategory);
    const isTargetFav = favorites.includes(targetCategory);

    let newFavs = [...favorites];

    const uniqueCatsSet = new Set(uniqueCategories);
    const customOrderSet = new Set(customOrder);
    const newOrder = [
      ...customOrder.filter(c => uniqueCatsSet.has(c)),
      ...uniqueCategories.filter(c => !customOrderSet.has(c))
    ];

    if (isDraggedFav && isTargetFav) {
      const draggedIdx = newFavs.indexOf(draggedCategory);
      const targetIdx = newFavs.indexOf(targetCategory);
      if (draggedIdx !== -1 && targetIdx !== -1) {
        newFavs.splice(draggedIdx, 1);
        newFavs.splice(targetIdx, 0, draggedCategory);
        setFavorites(newFavs);
        saveAppSetting(keys.favorites, newFavs);
      }
    } else if (!isDraggedFav && !isTargetFav) {
      const draggedIdx = newOrder.indexOf(draggedCategory);
      const targetIdx = newOrder.indexOf(targetCategory);
      if (draggedIdx !== -1 && targetIdx !== -1) {
        newOrder.splice(draggedIdx, 1);
        newOrder.splice(targetIdx, 0, draggedCategory);
        setCustomOrder(newOrder);
        saveAppSetting(keys.customOrder, newOrder);
      }
    } else if (!isDraggedFav && isTargetFav) {
      const targetIdx = newFavs.indexOf(targetCategory);
      if (targetIdx !== -1) {
        newFavs.splice(targetIdx, 0, draggedCategory);
      } else {
        newFavs.push(draggedCategory);
      }
      setFavorites(newFavs);
      saveAppSetting(keys.favorites, newFavs);
      showToast(language === 'tr' ? `"${draggedCategory}" favori ${labels.plural}ine eklendi` : `"${draggedCategory}" added to favorite ${labelsEn.plural}`);
    } else if (isDraggedFav && !isTargetFav) {
      newFavs = newFavs.filter(c => c !== draggedCategory);
      setFavorites(newFavs);
      saveAppSetting(keys.favorites, newFavs);

      const draggedIdx = newOrder.indexOf(draggedCategory);
      const targetIdx = newOrder.indexOf(targetCategory);
      if (draggedIdx !== -1 && targetIdx !== -1) {
        newOrder.splice(draggedIdx, 1);
        const newTargetIdx = newOrder.indexOf(targetCategory);
        newOrder.splice(newTargetIdx, 0, draggedCategory);
      }
      setCustomOrder(newOrder);
      saveAppSetting(keys.customOrder, newOrder);
      showToast(language === 'tr' ? `"${draggedCategory}" favori ${labels.plural}inden kaldırıldı` : `"${draggedCategory}" removed from favorite ${labelsEn.plural}`);
    }

    setDraggedCategory(null);
  }, [editMode, draggedCategory, favorites, customOrder, uniqueCategories, keys, saveAppSetting, showToast, labels.plural, labelsEn.plural, setFavorites, setCustomOrder, setDraggedCategory, language]);

  // Memos
  const orderedCategories = useMemo(() => {
    const uniqueSet = new Set(uniqueCategories);
    const customOrderFiltered = customOrder.filter(c => uniqueSet.has(c));
    const customOrderSet = new Set(customOrderFiltered);
    const remaining = uniqueCategories.filter(c => !customOrderSet.has(c));
    return [...customOrderFiltered, ...remaining];
  }, [uniqueCategories, customOrder]);

  const otherCategories = useMemo(() => {
    const favSet = new Set(favorites);
    const hiddenSet = new Set(hidden);
    return orderedCategories.filter(c => !favSet.has(c) && !hiddenSet.has(c));
  }, [orderedCategories, favorites, hidden]);

  const filteredOtherCategories = useMemo(() => {
    const query = categorySearchQuery.trim().toLowerCase();
    if (!query) return otherCategories;
    return otherCategories.filter(c => c.toLowerCase().includes(query));
  }, [otherCategories, categorySearchQuery]);

  return {
    // State (for JSX rendering)
    editMode,
    draggedCategory,
    hidden,
    // Setters
    setEditMode,
    // Actions
    toggleFavorite,
    handleHide,
    handleRestore,
    handleResetHidden,
    handleDragStart,
    handleDrop,
    // Memos
    orderedCategories,
    otherCategories,
    filteredOtherCategories,
  };
}
