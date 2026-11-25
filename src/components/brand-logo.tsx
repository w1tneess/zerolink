import type { SVGProps } from "react";

type BrandMarkProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

/**
 * Geometric ZeroLink brand mark (Concept A): closed capsule link
 * with a central crossbar forming a zero-link silhouette.
 */
export function ZeroLinkMark({
  size = 24,
  className = "",
  ...props
}: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`.trim()}
      {...props}
    >
      <g transform="rotate(-45 16 16)">
        <path
          d="M21 9.5H10.5A6.5 6.5 0 0 0 10.5 22.5H14.5"
          stroke="currentColor"
          strokeWidth="3.1"
          strokeLinecap="round"
        />
        <path
          d="M11 22.5H21.5A6.5 6.5 0 0 0 21.5 9.5H17.5"
          className="stroke-[var(--accent)] dark:stroke-[var(--accent-hover)]"
          strokeWidth="3.1"
          strokeLinecap="round"
        />
        <path
          d="M13 16H19"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
