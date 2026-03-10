import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap focus inside a container ref while active.
 * @param {boolean} active - whether the trap is active
 * @param {function} [onEscape] - callback when Escape key is pressed
 * @returns {React.RefObject} - ref to attach to the container element
 */
export default function useFocusTrap(active, onEscape) {
  const containerRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    // Save current focus so we can restore it later
    previousFocusRef.current = document.activeElement;

    // Focus the first focusable element inside the container
    const container = containerRef.current;
    if (!container) return;

    const timer = setTimeout(() => {
      const focusable = container.querySelectorAll(FOCUSABLE);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        container.focus();
      }
    }, 0);

    function handleKeyDown(e) {
      if (e.key === 'Escape' && onEscape) {
        e.stopPropagation();
        onEscape();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = container.querySelectorAll(FOCUSABLE);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      container.removeEventListener('keydown', handleKeyDown);
      // Restore previous focus
      if (previousFocusRef.current && previousFocusRef.current.focus) {
        previousFocusRef.current.focus();
      }
    };
  }, [active, onEscape]);

  return containerRef;
}
