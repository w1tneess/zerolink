import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initScroll, resetScroll, startScroll, stopScroll } from "./scroll";
import { initReveals } from "./reveal";
import { playEnter, playLeave } from "./transition";
import { prefersReducedMotion } from "./env";

export { onScroll, scrollState, stopScroll, startScroll } from "./scroll";
export { setTransition } from "./transition";
export { ease, isTouch, isMobile, prefersReducedMotion } from "./env";

export type PageFn = (page: {
  intro: gsap.core.Timeline;
  path: string;
}) => void | (() => void);

const pageFns = new Set<PageFn>();
const fnCleanups = new Map<PageFn, () => void>();
let ctx: gsap.Context | null = null;
let intro: gsap.core.Timeline | null = null;
let ready = false;
let booted = false;

export function onPage(fn: PageFn) {
  pageFns.add(fn);
  if (ready) runPageFn(fn);
  return () => {
    pageFns.delete(fn);
    const c = fnCleanups.get(fn);
    if (c) {
      fnCleanups.delete(fn);
      c();
    }
  };
}

function runPageFn(fn: PageFn) {
  const prev = fnCleanups.get(fn);
  if (prev) {
    fnCleanups.delete(fn);
    prev();
  }
  ctx?.add(() => {
    const c = fn({ intro: intro!, path: window.location.pathname });
    if (typeof c === "function") fnCleanups.set(fn, c);
  });
}

export function syncFlags() {
  const h = document.documentElement.classList;
  h.add("js", "is-booted");
  h.toggle("motion", !prefersReducedMotion());
}

function initPage(animateIntro = true) {
  syncFlags();
  ctx = gsap.context(() => {
    intro = initReveals(document, animateIntro);
  });
  ready = true;
  pageFns.forEach(runPageFn);
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

export async function boot(setup?: () => void) {
  if (booted || typeof window === "undefined") return;
  booted = true;
  syncFlags();
  initScroll();
  setup?.();
  initPage(true);
  intro?.play();
}

export async function leave() {
  stopScroll();
  await playLeave();
}

export function cleanup() {
  if (!ready) return;
  ready = false;
  fnCleanups.forEach((c) => c());
  fnCleanups.clear();
  ctx?.revert();
  ctx = null;
}

export async function enter({ transition = true, scrollTop = true } = {}) {
  if (!booted) return;
  cleanup();
  if (scrollTop) resetScroll();
  initPage(transition);
  if (transition) await playEnter();
  startScroll();
  if (transition) intro?.play();
}
