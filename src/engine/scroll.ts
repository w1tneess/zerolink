import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "./env";

gsap.registerPlugin(ScrollTrigger);

export type ScrollState = { y: number; velocity: number; progress: number };

let lenis: Lenis | null = null;
let tickerBound = false;
const listeners = new Set<(s: ScrollState) => void>();
const state: ScrollState = { y: 0, velocity: 0, progress: 0 };

function nativeTick() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  state.velocity = window.scrollY - state.y;
  state.y = window.scrollY;
  state.progress = max > 0 ? window.scrollY / max : 0;
  listeners.forEach((fn) => fn(state));
}

export function initScroll() {
  if (typeof window === "undefined") return;
  if (lenis || prefersReducedMotion()) {
    if (!lenis) window.addEventListener("scroll", nativeTick, { passive: true });
    return;
  }

  lenis = new Lenis({
    lerp: 0.11,
    wheelMultiplier: 1,
    touchMultiplier: 1.15,
    anchors: true,
  });

  lenis.on("scroll", (l: Lenis) => {
    state.y = l.scroll;
    state.velocity = l.velocity;
    state.progress = l.limit > 0 ? l.scroll / l.limit : 0;
    ScrollTrigger.update();
    listeners.forEach((fn) => fn(state));
  });

  if (!tickerBound) {
    tickerBound = true;
    gsap.ticker.add((time) => lenis?.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
}

export const onScroll = (fn: (s: ScrollState) => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const scrollState = () => state;
export const stopScroll = () => lenis?.stop();
export const startScroll = () => lenis?.start();

export function resetScroll() {
  if (typeof window === "undefined") return;
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
  state.y = 0;
  state.velocity = 0;
}
