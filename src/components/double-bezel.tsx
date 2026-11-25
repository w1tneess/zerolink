import type { ReactNode } from "react";

interface DoubleBezelProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}

/**
 * Hardware-grade Double-Bezel (Doppelrand) enclosure with concentric radii
 * and an inner top specular highlight.
 */
export function DoubleBezel({
  children,
  className = "",
  innerClassName = "",
}: DoubleBezelProps) {
  return (
    <div
      className={`rounded-3xl bg-[var(--bezel-outer)] p-2 ring-1 ring-[var(--bezel-ring)] ${className}`}
    >
      <div
        className={`rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-ambient),inset_0_1px_0_var(--inner-highlight)] ${innerClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
