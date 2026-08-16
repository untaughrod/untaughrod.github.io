/**
 * Custom cursor: a hard dot that tracks the pointer exactly, and a ring that
 * lags behind it. The lag is what makes it feel like an object rather than a
 * texture, and it grows over anything clickable.
 */

const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (fine && !reduced) {
  const root = document.querySelector<HTMLElement>('[data-cursor]');
  const dot = document.querySelector<HTMLElement>('[data-cursor-dot]');
  const ring = document.querySelector<HTMLElement>('[data-cursor-ring]');

  if (root && dot && ring) {
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let ringX = pointerX;
    let ringY = pointerY;
    let visible = false;

    window.addEventListener(
      'pointermove',
      (event) => {
        pointerX = event.clientX;
        pointerY = event.clientY;

        if (!visible) {
          visible = true;
          root.style.opacity = '1';
        }
      },
      { passive: true },
    );

    // Hide when the pointer leaves the window so it doesn't stick to an edge.
    document.addEventListener('pointerleave', () => {
      visible = false;
      root.style.opacity = '0';
    });

    const HOT = 'a, button, [data-hot], input, textarea, select, summary';

    document.addEventListener('pointerover', (event) => {
      const target = event.target as Element | null;
      if (target?.closest?.(HOT)) root.classList.add('is-hot');
    });

    document.addEventListener('pointerout', (event) => {
      const target = event.target as Element | null;
      if (target?.closest?.(HOT)) root.classList.remove('is-hot');
    });

    root.style.opacity = '0';
    root.style.transition = 'opacity 0.3s ease';

    const tick = () => {
      // Exponential smoothing: the ring covers 18% of the remaining gap each
      // frame, which reads as weight without ever visibly settling.
      ringX += (pointerX - ringX) * 0.18;
      ringY += (pointerY - ringY) * 0.18;

      dot.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}
