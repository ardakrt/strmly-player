import { useEffect, type RefObject } from "react";

export function useSpotlightFocus(
  isOpen: boolean,
  dialogRef: RefObject<HTMLDivElement | null>,
  inputRef: RefObject<HTMLInputElement | null>,
) {
  useEffect(() => {
    if (!isOpen) return;

    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    const overlay = dialog?.parentElement;
    const appWrapper = dialog?.closest(".app-wrapper");
    const inertedSiblings: HTMLElement[] = [];

    if (appWrapper && overlay) {
      for (const child of Array.from(appWrapper.children)) {
        if (
          !(child instanceof HTMLElement) ||
          child === overlay ||
          child.inert
        ) {
          continue;
        }
        child.inert = true;
        inertedSiblings.push(child);
      }
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          !element.hidden && element.getAttribute("aria-hidden") !== "true",
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog?.addEventListener("keydown", keepFocusInside);
    return () => {
      window.clearTimeout(timer);
      dialog?.removeEventListener("keydown", keepFocusInside);
      for (const sibling of inertedSiblings) sibling.inert = false;
      if (returnFocus) {
        returnFocus.dataset.spotlightReturnFocus = "true";
        returnFocus.focus({ preventScroll: true });
      }
    };
  }, [isOpen, dialogRef, inputRef]);
}
