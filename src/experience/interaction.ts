import { useEffect } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Hover tilt for floating cards. Writes only --rx/--ry/--gx/--gy on the hovered element; CSS owns the
 * transition, so the card eases back on leave. Touch gets a press state instead of tilt.
 */
export const tilt = {
  onPointerMove(e: ReactPointerEvent<HTMLElement>) {
    if (e.pointerType !== 'mouse') return;
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-y * 7).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(x * 9).toFixed(2)}deg`);
    el.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
  },
  onPointerLeave(e: ReactPointerEvent<HTMLElement>) {
    const el = e.currentTarget;
    for (const p of ['--rx', '--ry', '--gx', '--gy']) el.style.removeProperty(p);
    el.classList.remove('is-pressed');
  },
  onPointerDown(e: ReactPointerEvent<HTMLElement>) { if (e.pointerType !== 'mouse') e.currentTarget.classList.add('is-pressed'); },
  onPointerUp(e: ReactPointerEvent<HTMLElement>) { e.currentTarget.classList.remove('is-pressed'); },
  onPointerCancel(e: ReactPointerEvent<HTMLElement>) { e.currentTarget.classList.remove('is-pressed'); },
};

/** One-shot fade-up for `.reveal` blocks. Re-scans when `deps` change so new results also reveal. */
export function useReveal(deps: unknown[]) {
  useEffect(() => {
    document.documentElement.classList.add('reveal-ready');
    const io = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    document.querySelectorAll('.reveal:not(.is-in)').forEach(el => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function scrollToId(id: string, block: ScrollLogicalPosition = 'start') {
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block });
}
