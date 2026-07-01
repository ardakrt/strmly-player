import { getToastDetails } from '../utils/toastHelpers';

interface DynamicIslandToastProps {
  message: string;
  visible: boolean;
  exit: boolean;
  scrolled: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function DynamicIslandToast({
  message,
  visible,
  exit,
  scrolled,
  onMouseEnter,
  onMouseLeave,
}: DynamicIslandToastProps) {
  if (!message) return null;

  const { icon, colorClass } = getToastDetails(message);

  return (
    <div
      className={`dynamic-island-toast select-none ${
        scrolled ? 'scrolled' : ''
      } ${visible ? 'visible' : ''} ${exit ? 'exit' : ''} ${colorClass}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="dynamic-island-content">
        {icon}
        <span className="text-[12px] font-semibold tracking-wide text-neutral-100">{message}</span>
      </div>
    </div>
  );
}
