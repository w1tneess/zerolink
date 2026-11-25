import { gsap } from "gsap";
import { ease, prefersReducedMotion } from "./env";

export type Transition = {
  leave: (curtain: HTMLElement) => Promise<unknown> | gsap.core.Animation;
  enter: (curtain: HTMLElement) => Promise<unknown> | gsap.core.Animation;
};

let current: Transition = {
  leave: (c) =>
    gsap
      .timeline()
      .set(c, { autoAlpha: 1 })
      .fromTo(
        c.querySelector(".curtain__panel"),
        { clipPath: "inset(100% 0% 0% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 0.42, ease: ease.inOut }
      ),
  enter: (c) =>
    gsap
      .timeline()
      .to(c.querySelector(".curtain__panel"), {
        clipPath: "inset(0% 0% 100% 0%)",
        duration: 0.48,
        ease: ease.inOut,
      })
      .set(c, { autoAlpha: 0 }),
};

const reduced: Transition = {
  leave: (c) =>
    gsap
      .timeline()
      .set(c, { autoAlpha: 1 })
      .fromTo(c, { opacity: 0 }, { opacity: 1, duration: 0.14 }),
  enter: (c) => gsap.to(c, { autoAlpha: 0, duration: 0.14 }),
};

const pick = () => (prefersReducedMotion() ? reduced : current);
const curtain = () => document.getElementById("curtain");

export const setTransition = (t: Transition) => {
  current = t;
};

export const playLeave = () => {
  const el = curtain();
  if (!el) return Promise.resolve();
  return Promise.resolve(pick().leave(el));
};

export const playEnter = () => {
  const el = curtain();
  if (!el) return Promise.resolve();
  return Promise.resolve(pick().enter(el));
};
