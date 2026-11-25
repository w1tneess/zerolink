import { gsap } from "gsap";
import { ease, setTransition } from "@/engine";

export function setupMotion() {
  let point = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  window.addEventListener(
    "pointerdown",
    (e) => {
      point = { x: e.clientX, y: e.clientY };
    },
    { passive: true }
  );

  setTransition({
    leave: (c) => {
      const panel = c.querySelector(".curtain__panel");
      if (!panel) return gsap.timeline();
      return gsap
        .timeline()
        .set(c, { autoAlpha: 1 })
        .fromTo(
          panel,
          { clipPath: `circle(0% at ${point.x}px ${point.y}px)`, opacity: 0.92 },
          {
            clipPath: `circle(155% at ${point.x}px ${point.y}px)`,
            opacity: 0.96,
            duration: 0.3,
            ease: ease.inOut,
          }
        );
    },
    enter: (c) => {
      const panel = c.querySelector(".curtain__panel");
      if (!panel) return gsap.timeline();
      return gsap
        .timeline()
        .to(panel, {
          clipPath: "circle(0% at 50% 50%)",
          opacity: 0,
          duration: 0.34,
          ease: ease.inOut,
        })
        .set(c, { autoAlpha: 0 });
    },
  });
}
