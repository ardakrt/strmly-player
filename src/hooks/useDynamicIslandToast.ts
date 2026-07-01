import { useState, useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (toast.show) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (toastExitTimerRef.current) clearTimeout(toastExitTimerRef.current);

      setToastMessage(toast.message);
      setToastExit(false);
      setToastVisible(true);

      toastTimerRef.current = setTimeout(() => {
        setToastVisible(false);
        setToastExit(true);
        toastExitTimerRef.current = setTimeout(() => {
          setToastMessage('');
          setToastExit(false);
          hideToast();
        }, 500);
      }, 5000);
    }
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (toastExitTimerRef.current) clearTimeout(toastExitTimerRef.current);
    };
  }, [toast.show, toast.message, hideToast]);

  const handleToastMouseEnter = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  };

  const handleToastMouseLeave = () => {
    if (!toastVisible || toastExit) return;
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      setToastExit(true);
      toastExitTimerRef.current = setTimeout(() => {
        setToastMessage('');
        setToastExit(false);
        hideToast();
      }, 500);
    }, 5000);
  };

  return {
    toastMessage,
    toastVisible,
    toastExit,
    handleToastMouseEnter,
    handleToastMouseLeave,
  };
}
