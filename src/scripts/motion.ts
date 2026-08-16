import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Reveal-on-scroll.
 *
 * Deliberately not a GSAP animation: the CSS transition in global.css does the
 * work, so an element that is already in view on load reveals immediately and
 * nothing depends on ScrollTrigger having measured correctly.
 */
function initReveals() {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');

  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const el = entry.target as HTMLElement;
        // Stagger siblings so a grid resolves as a wave rather than a slab.
        const delay = Number(el.dataset.revealDelay ?? 0);
        window.setTimeout(() => el.classList.add('is-revealed'), delay);
        io.unobserve(el);
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.1 },
  );

  targets.forEach((el) => io.observe(el));
}

/** Lenis smooth scroll, driven off the GSAP ticker so the two stay in phase. */
function initSmoothScroll() {
  if (reduced) return;

  const lenis = new Lenis({
    duration: 1.1,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    // Native momentum on touch is better than anything we'd synthesise.
    syncTouch: false,
  });

  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Anchor links must go through Lenis or they jump while it keeps scrolling.
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;

      const target = document.querySelector(id);
      if (!target) return;

      event.preventDefault();
      // Clears the fixed nav, which is ~73px tall with the 39px logo mark.
      lenis.scrollTo(target as HTMLElement, { offset: -90 });
    });
  });
}

/**
 * The scroll-cinema pieces: pinned discipline list, horizontal work rail, and
 * the letter-by-letter section headings.
 */
function initScrollScenes() {
  if (reduced) return;

  // --- Headings: characters rise as the heading enters ----------------------
  document.querySelectorAll<HTMLElement>('[data-split]').forEach((heading) => {
    const text = heading.textContent ?? '';
    heading.textContent = '';
    // Keep the original text available to assistive tech; the spans are noise.
    heading.setAttribute('aria-label', text);

    const chars = [...text].map((char) => {
      const outer = document.createElement('span');
      outer.style.display = 'inline-block';
      outer.style.overflow = 'hidden';
      outer.style.verticalAlign = 'top';
      outer.setAttribute('aria-hidden', 'true');

      const inner = document.createElement('span');
      inner.style.display = 'inline-block';
      inner.textContent = char === ' ' ? ' ' : char;

      outer.appendChild(inner);
      heading.appendChild(outer);
      return inner;
    });

    gsap.from(chars, {
      yPercent: 110,
      duration: 0.9,
      ease: 'expo.out',
      stagger: 0.022,
      scrollTrigger: { trigger: heading, start: 'top 85%' },
    });
  });

  // --- Discipline list: the active row lights as it crosses the midline -----
  const rows = gsap.utils.toArray<HTMLElement>('[data-discipline]');
  rows.forEach((row) => {
    ScrollTrigger.create({
      trigger: row,
      start: 'top 65%',
      end: 'bottom 35%',
      onToggle: ({ isActive }) => row.classList.toggle('is-active', isActive),
    });
  });

  // --- Work rail: scrolls horizontally while the section is pinned ----------
  const rail = document.querySelector<HTMLElement>('[data-rail]');
  const railTrack = document.querySelector<HTMLElement>('[data-rail-track]');

  if (rail && railTrack) {
    // Only pin where there is room; on narrow screens the rail stays a normal
    // touch-scrolling row.
    ScrollTrigger.matchMedia({
      '(min-width: 900px)': () => {
        const distance = () => railTrack.scrollWidth - window.innerWidth + 120;

        const tween = gsap.to(railTrack, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: rail,
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.8,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
          gsap.set(railTrack, { clearProps: 'x' });
        };
      },
    });
  }

  // --- Marquee: seamless because the track is duplicated in the markup ------
  document.querySelectorAll<HTMLElement>('[data-marquee-track]').forEach((track) => {
    gsap.to(track, {
      xPercent: -50,
      duration: 28,
      ease: 'none',
      repeat: -1,
    });
  });
}

function boot() {
  initReveals();
  initSmoothScroll();
  initScrollScenes();

  // Late-loading fonts change text metrics, which invalidates every pinned
  // measurement ScrollTrigger took.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
