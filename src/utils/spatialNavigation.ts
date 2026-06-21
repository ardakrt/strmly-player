export function initSpatialNavigation() {
  const handleKeyDown = (e: KeyboardEvent) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'];
    if (!keys.includes(e.key)) return;

    // Ignore if typing in input/textarea
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      if (e.key === 'Enter') {
        // Allow enter in inputs
        return;
      }
      // Don't intercept arrow keys inside inputs
      return;
    }

    const focusables = Array.from(document.querySelectorAll('.focusable-item')) as HTMLElement[];
    const visibleFocusables = focusables.filter(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });

    if (visibleFocusables.length === 0) return;

    // Default focus if nothing is focused or active is not in the list
    const currentActiveIdx = active ? visibleFocusables.indexOf(active as HTMLElement) : -1;
    if (currentActiveIdx === -1) {
      if (e.key !== 'Enter') {
        visibleFocusables[0].focus();
        e.preventDefault();
      }
      return;
    }

    const currentActive = active as HTMLElement;

    if (e.key === 'Enter') {
      currentActive.click();
      e.preventDefault();
      return;
    }

    e.preventDefault(); // Stop window scroll

    const activeRect = currentActive.getBoundingClientRect();
    const ax = activeRect.left + activeRect.width / 2;
    const ay = activeRect.top + activeRect.height / 2;

    const candidates: { el: HTMLElement; score: number }[] = [];

    for (let i = 0; i < visibleFocusables.length; i++) {
      const cand = visibleFocusables[i];
      if (cand === currentActive) continue;

      const candRect = cand.getBoundingClientRect();
      const cx = candRect.left + candRect.width / 2;
      const cy = candRect.top + candRect.height / 2;

      const dX = cx - ax;
      const dY = cy - ay;

      let isVal = false;
      let score = 0;

      if (e.key === 'ArrowLeft' && dX < -1) {
        isVal = true;
        score = Math.abs(dX) + Math.abs(dY) * 2.8;
      } else if (e.key === 'ArrowRight' && dX > 1) {
        isVal = true;
        score = Math.abs(dX) + Math.abs(dY) * 2.8;
      } else if (e.key === 'ArrowUp' && dY < -1) {
        isVal = true;
        score = Math.abs(dY) + Math.abs(dX) * 2.8;
      } else if (e.key === 'ArrowDown' && dY > 1) {
        isVal = true;
        score = Math.abs(dY) + Math.abs(dX) * 2.8;
      }

      if (isVal) {
        candidates.push({ el: cand, score });
      }
    }

    if (candidates.length > 0) {
      // Sort by score ascending
      candidates.sort((a, b) => a.score - b.score);
      candidates[0].el.focus();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}
