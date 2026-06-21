import { Heart, Info, Play } from 'lucide-react';
import type { PlaylistItem } from '../utils/m3uParser';
import type { GroupedSeries } from '../utils/seriesGroupers';
import { cleanMediaTitle } from '../utils/seriesGroupers';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { useSettings } from '../context/SettingsContext';

interface MediaCardContextMenuProps {
  x: number;
  y: number;
  item: PlaylistItem | GroupedSeries;
  isFavorite: boolean;
  onClose: () => void;
  onPlay?: (item: PlaylistItem) => void;
  onOpenDetails?: (item: PlaylistItem | GroupedSeries) => void;
  onToggleFavorite: (id: string) => void;
}

export function MediaCardContextMenu({
  x,
  y,
  item,
  isFavorite,
  onClose,
  onPlay,
  onOpenDetails,
  onToggleFavorite
}: MediaCardContextMenuProps) {
  const { language } = useSettings();
  const isSeries = 'seasons' in item || item.type === 'series';
  const items: ContextMenuItem[] = [];

  if (onPlay && !('seasons' in item)) {
    items.push({
      id: 'play',
      label: item.type === 'live' 
        ? (language === 'tr' ? 'Kanalı oynat' : 'Play channel') 
        : (language === 'tr' ? 'Şimdi oynat' : 'Play now'),
      icon: <Play size={15} fill="currentColor" />,
      onSelect: () => onPlay(item)
    });
  }

  if (onOpenDetails) {
    items.push({
      id: 'details',
      label: isSeries 
        ? (language === 'tr' ? 'Dizi detayına git' : 'Go to series details') 
        : (language === 'tr' ? 'Detayları aç' : 'Open details'),
      icon: <Info size={16} />,
      onSelect: () => onOpenDetails(item)
    });
  }

  items.push({
    id: 'favorite',
    label: isFavorite 
      ? (language === 'tr' ? 'Favorilerden çıkar' : 'Remove from favorites') 
      : (language === 'tr' ? 'Favorilere ekle' : 'Add to favorites'),
    icon: <Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} />,
    separatorBefore: items.length > 1,
    onSelect: () => onToggleFavorite(item.id)
  });

  return (
    <ContextMenu
      x={x}
      y={y}
      title={'seasons' in item ? item.name : cleanMediaTitle(item.name)}
      subtitle={item.group || (isSeries ? (language === 'tr' ? 'Dizi' : 'Series') : (language === 'tr' ? 'Medya' : 'Media'))}
      items={items}
      onClose={onClose}
    />
  );
}

