import { useMemo } from 'react';
import type { PlayerQualityLevel } from '../../hooks/useCinematicPlayer';

interface PlayerSourceLabelsInput {
  channelName: string;
  channelUrl: string;
  language: 'tr' | 'en';
  qualityLevels: PlayerQualityLevel[];
  activeQualityLevel: number;
  audioTracks: { id: number; name: string; lang: string }[];
}

export function usePlayerSourceLabels({ channelName, channelUrl, language, qualityLevels, activeQualityLevel, audioTracks }: PlayerSourceLabelsInput) {
  const displayAudioTracks = useMemo(() => audioTracks.length > 0 ? audioTracks : [{ id: 0, name: language === 'tr' ? 'Varsayılan Ses' : 'Default Audio', lang: '' }], [audioTracks, language]);
  const sourceQualityLabel = useMemo(() => {
    const hlsLevel = qualityLevels.find((level) => level.id === activeQualityLevel);
    if (hlsLevel) return hlsLevel.label;
    if (qualityLevels.length > 0 && activeQualityLevel === -1) return language === 'tr' ? 'Otomatik' : 'Auto';
    const text = `${channelName} ${channelUrl}`.toLowerCase();
    if (text.includes('2160') || text.includes('4k') || text.includes('uhd')) return '4K';
    if (text.includes('1080') || text.includes('fhd')) return '1080p';
    if (text.includes('720') || text.includes('hd')) return '720p';
    return language === 'tr' ? 'Tek kaynak' : 'Single source';
  }, [activeQualityLevel, channelName, channelUrl, language, qualityLevels]);
  const sourceTypeLabel = useMemo(() => {
    if (qualityLevels.length > 0 || channelUrl.toLowerCase().includes('.m3u8')) return 'HLS';
    const extension = channelUrl.split('?')[0].toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    return extension ? extension.toUpperCase() : (language === 'tr' ? 'Doğrudan kaynak' : 'Direct source');
  }, [channelUrl, language, qualityLevels.length]);
  return { displayAudioTracks, sourceQualityLabel, sourceTypeLabel };
}
