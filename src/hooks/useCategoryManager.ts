import { useMemo, useEffect, useCallback } from 'react';

type Domain = 'live' | 'series' | 'movie';

interface UseCategoryManagerOptions {
  domain: Domain;
  uniqueCategories: string[];
  categorySearchQuery: string;
  saveAppSetting: (key: string, value: any) => Promise<void>;
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

export function useCategoryManager(options: UseCategoryManagerOptions) {
  const {
    domain, uniqueCategories, categorySearchQuery, saveAppSetting, showToast,
    activeCategory, setActiveCategory,
    favorites, setFavorites, customOrder, setCustomOrder, hidden, setHidden,
    editMode, setEditMode, draggedCategory, setDraggedCategory,
  } = options;
  const keys = KEYS[domain];
  const labels = LABELS[domain];

  // Sync custom category order with playlist items
  useEffect(() => {
    if (uniqueCategories.length === 0) return;
    setCustomOrder(prevOrder => {
      const updatedOrder = [
        ...prevOrder.filter(c => uniqueCategories.includes(c)),
        ...uniqueCategories.filter(c => !prevOrder.includes(c))
      ];
      const hasChanged =
        updatedOrder.length !== prevOrder.length ||
        updatedOrder.some((val, index) => val !== prevOrder[index]);
      if (hasChanged) {
        saveAppSetting(keys.customOrder, updatedOrder);
        return updatedOrder;
      }
      return prevOrder;
    });
  }, [uniqueCategories, keys.customOrder, saveAppSetting, setCustomOrder]);

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
    showToast(`"${categoryName}" ${labels.singular} gizlendi`);
    if (activeCategory === categoryName) {
      setActiveCategory('Tümü');
    }
  }, [hidden, keys.hidden, saveAppSetting, showToast, labels.singular, activeCategory, setActiveCategory, setHidden]);

  const handleRestore = useCallback((categoryName: string) => {
    const updated = hidden.filter(c => c !== categoryName);
    setHidden(updated);
    saveAppSetting(keys.hidden, updated);
    showToast(`"${categoryName}" ${labels.singular} geri getirildi`);
  }, [hidden, keys.hidden, saveAppSetting, showToast, labels.singular, setHidden]);

  const handleResetHidden = useCallback(() => {
    setHidden([]);
    saveAppSetting(keys.hidden, []);
    showToast(`Tüm gizlenen ${labels.plural} geri getirildi`);
  }, [keys.hidden, saveAppSetting, showToast, labels.plural, setHidden]);

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

    const newOrder = [
      ...customOrder.filter(c => uniqueCategories.includes(c)),
      ...uniqueCategories.filter(c => !customOrder.includes(c))
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
      showToast(`"${draggedCategory}" favori ${labels.plural}ine eklendi`);
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
      showToast(`"${draggedCategory}" favori ${labels.plural}inden kaldırıldı`);
    }

    setDraggedCategory(null);
  }, [editMode, draggedCategory, favorites, customOrder, uniqueCategories, keys, saveAppSetting, showToast, labels.plural, setFavorites, setCustomOrder, setDraggedCategory]);

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
