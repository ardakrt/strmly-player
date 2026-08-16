export type PlayerVideoEventHandlers = {
  error: () => void;
  play: () => void;
  playing: () => void;
  canplay: () => void;
  volumechange: () => void;
  loadedmetadata: () => void;
  timeupdate: () => void;
  durationchange: () => void;
  pause: () => void;
  waiting: () => void;
  seeking: () => void;
  seeked: () => void;
  progress: () => void;
};

export function attachPlayerVideoEvents(
  video: HTMLVideoElement,
  handlers: PlayerVideoEventHandlers,
): () => void {
  const entries = Object.entries(handlers) as Array<
    [keyof PlayerVideoEventHandlers, () => void]
  >;
  for (const [eventName, handler] of entries) {
    video.addEventListener(eventName, handler);
  }
  return () => {
    for (const [eventName, handler] of entries) {
      video.removeEventListener(eventName, handler);
    }
  };
}
