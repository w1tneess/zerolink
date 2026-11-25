import type { SVGProps } from "react";

type BrandMarkProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

/**
 * Geometric ZeroLink brand mark: two interlocking routing arms forming
 * a slashed zero and forward-link channel.
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
          d="M20.5 6.6H10.2A3.35 3.35 0 0 0 10.2 13.3H18.2"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11.5 25.4H21.8A3.35 3.35 0 0 0 21.8 18.7H13.8"
          stroke="var(--accent)"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
