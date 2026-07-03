import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';

function normalizeMessage(message: string) {
  return message.toLocaleLowerCase('tr-TR');
}

export function getToastDetails(message: string) {
  const msgLower = normalizeMessage(message);

  if (
    msgLower.includes('yükleniyor') ||
    msgLower.includes('güncelleniyor') ||
    msgLower.includes('indiriliyor') ||
    msgLower.includes('kaydediliyor') ||
    msgLower.includes('bağlanılıyor') ||
    msgLower.includes('çözümleniyor') ||
    msgLower.includes('loading') ||
    msgLower.includes('updating') ||
    msgLower.includes('downloading') ||
    msgLower.includes('saving') ||
    msgLower.includes('connecting')
  ) {
    return {
      icon: <Loader2 size={14} className="text-blue-400 animate-spin shrink-0" />,
      colorClass: 'border-blue-500/20 shadow-[0_4px_16px_rgba(59,130,246,0.12)]',
    };
  }

  if (
    msgLower.includes('hata') ||
    msgLower.includes('başarısız') ||
    msgLower.includes('bulunamadı') ||
    msgLower.includes('olamadı') ||
    msgLower.includes('error') ||
    msgLower.includes('failed') ||
    msgLower.includes('yanlış') ||
    msgLower.includes('invalid')
  ) {
    return {
      icon: <AlertCircle size={14} className="text-red-400 shrink-0" />,
      colorClass: 'border-red-500/20 shadow-[0_4px_16px_rgba(239,68,68,0.12)]',
    };
  }

  if (
    msgLower.includes('başarılı') ||
    msgLower.includes('eklendi') ||
    msgLower.includes('güncellendi') ||
    msgLower.includes('yüklendi') ||
    msgLower.includes('kaydedildi') ||
    msgLower.includes('başlatıldı') ||
    msgLower.includes('temizlendi') ||
    msgLower.includes('kaldırıldı') ||
    msgLower.includes('success') ||
    msgLower.includes('imported') ||
    msgLower.includes('complete') ||
    msgLower.includes('cleared') ||
    msgLower.includes('added') ||
    msgLower.includes('removed') ||
    msgLower.includes('aktarıldı')
  ) {
    return {
      icon: <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />,
      colorClass: 'border-emerald-500/20 shadow-[0_4px_16px_rgba(16,185,129,0.12)]',
    };
  }

  return {
    icon: <Info size={14} className="text-[var(--accent-color)] shrink-0" />,
    colorClass: 'border-white/12 shadow-[0_4px_16px_rgba(255,255,255,0.08)]',
  };
}

export function getToastDuration(message: string) {
  const msgLower = normalizeMessage(message);
  const isError =
    msgLower.includes('hata') ||
    msgLower.includes('başarısız') ||
    msgLower.includes('bulunamadı') ||
    msgLower.includes('olamadı') ||
    msgLower.includes('error') ||
    msgLower.includes('failed') ||
    msgLower.includes('invalid');

  const isProgress =
    msgLower.includes('yükleniyor') ||
    msgLower.includes('güncelleniyor') ||
    msgLower.includes('indiriliyor') ||
    msgLower.includes('kaydediliyor') ||
    msgLower.includes('loading') ||
    msgLower.includes('updating') ||
    msgLower.includes('downloading') ||
    msgLower.includes('saving');

  if (isError) return 3200;
  if (isProgress) return 2200;
  if (message.length > 70) return 2600;
  return 1600;
}
