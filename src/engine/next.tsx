"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { boot, cleanup, enter, leave, onPage, type PageFn } from "./index";

export function Engine({ setup }: { setup?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const mode = useRef<"idle" | "push" | "pop">("idle");
  const first = useRef(true);

  useEffect(() => {
    boot(setup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onClick = async (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const a = (e.target as Element).closest("a");
      if (
        !a ||
        (a.target && a.target !== "_self") ||
        a.hasAttribute("download") ||
        a.hasAttribute("data-no-transition")
      ) {
        return;
      }
      const url = new URL(a.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        url.pathname === window.location.pathname
      ) {
        return;
      }
      e.preventDefault();
      if (mode.current !== "idle") return;
      mode.current = "push";
      const href = url.pathname + url.search + url.hash;
      const fromPath = window.location.pathname;
      router.prefetch(href);
      try {
        await leave();
        cleanup();
        router.push(href, { scroll: false });
        window.setTimeout(() => {
          if (mode.current === "push" && window.location.pathname === fromPath) {
            mode.current = "idle";
            void enter({ transition: true, scrollTop: false });
          }
        }, 1800);
      } catch {
        mode.current = "idle";
        void enter({ transition: true, scrollTop: false });
      }
    };

    const onPop = () => {
      mode.current = "pop";
      cleanup();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, [router]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const pop = mode.current === "pop";
    mode.current = "idle";
    void enter({ transition: !pop, scrollTop: !pop }).then(() => {
      if (!pop) {
        requestAnimationFrame(() => {
          document.getElementById("main")?.focus({ preventScroll: true });
        });
      }
    });
  }, [pathname]);

  return null;
}

export function usePage(fn: PageFn) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => onPage((page) => fnRef.current(page)), []);
}
