import { useState, useEffect, useRef, useCallback } from 'react';
import { getToastDuration } from '../utils/toastHelpers';

interface UseDynamicIslandToastProps {
  toast: { show: boolean; message: string };
  hideToast: () => void;
}

export function useDynamicIslandToast({ toast, hideToast }: UseDynamicIslandToastProps) {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastExit, setToastExit] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startToastExit = useCallback(() => {
    setToastVisible(false);
    setToastExit(true);
    toastExitTimerRef.current = setTimeout(() => {
      setToastMessage('');
      setToastExit(false);
      hideToast();
    }, 320);
  }, [hideToast]);

  useEffect(() => {
    if (toast.show) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (toastExitTimerRef.current) clearTimeout(toastExitTimerRef.current);

      setToastMessage(toast.message);
      setToastExit(false);
      setToastVisible(true);

      toastTimerRef.current = setTimeout(startToastExit, getToastDuration(toast.message));
    }
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (toastExitTimerRef.current) clearTimeout(toastExitTimerRef.current);
    };
  }, [toast.show, toast.message, startToastExit]);

  const handleToastMouseEnter = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  };

  const handleToastMouseLeave = () => {
    if (!toastVisible || toastExit) return;
    toastTimerRef.current = setTimeout(startToastExit, Math.min(1200, getToastDuration(toastMessage)));
  };

  return {
    toastMessage,
    toastVisible,
    toastExit,
    handleToastMouseEnter,
    handleToastMouseLeave,
  };
}
