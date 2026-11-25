import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

export function IconArrowUpRight({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

export function IconArrowRight({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconCopy({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconCheck({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function IconDownload({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 4v11m0 0l-4-4m4 4l4-4M4 19h16" />
    </svg>
  );
}

export function IconUpload({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 15V4m0 0L8 8m4-4l4 4M4 19h16" />
    </svg>
  );
}

export function IconSliders({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="var(--surface)" />
      <circle cx="15" cy="17" r="2" fill="var(--surface)" />
    </svg>
  );
}

export function IconLock({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function IconKey({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="8" cy="14" r="4" />
      <path d="M11 11l9-9m-3 3l2 2m-4-0l2 2" />
    </svg>
  );
}

export function IconShield({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3Z" />
      <path d="M9.5 12.2l1.7 1.8 3.5-3.8" />
    </svg>
  );
}

export function IconShieldOff({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3Z" />
      <path d="M9 9l6 6" />
    </svg>
  );
}

export function IconGlobe({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 12h17M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9s1.3-6.3 3.8-9Z" />
    </svg>
  );
}

export function IconEye({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function IconEyeOff({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M3 3l18 18M10.5 6.3A10.6 10.6 0 0 1 12 6c6.2 0 10 6 10 6a17 17 0 0 1-3.3 4M6.6 6.7C3.8 8.6 2 12 2 12s3.8 6 10 6c1.5 0 2.9-.3 4.2-.9" />
    </svg>
  );
}

export function IconSun({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconMoon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />
    </svg>
  );
}

export function IconLink({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l2.8-2.8a4.5 4.5 0 0 0-6.4-6.4L11 6.5" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0L4.8 12.8a4.5 4.5 0 0 0 6.4 6.4L13 17.5" />
    </svg>
  );
}

export function IconFlag({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M5 20V4m0 1h12l-2.5 4L17 13H5" />
    </svg>
  );
}

export function IconSettings({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2m0 14v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M3 12h2m14 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4" />
    </svg>
  );
}

export function IconCommand({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M9 9h6v6H9V9Zm0 0V6a3 3 0 1 0-3 3h3Zm6 0V6a3 3 0 1 1 3 3h-3Zm-6 6v3a3 3 0 1 1-3-3h3Zm6 0v3a3 3 0 1 0 3-3h-3Z" />
    </svg>
  );
}

export function IconLogOut({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M9 12h10" />
    </svg>
  );
}

export function IconPlus({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconEdit({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M15.5 4.5l4 4L8 20H4v-4L15.5 4.5Z" />
    </svg>
  );
}

export function IconTrash({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  );
}

export function IconClock({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconHash({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16" />
    </svg>
  );
}

export function IconSpinner({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} className={`animate-spin ${props.className ?? ""}`}>
      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}

export function IconCookie({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size)} {...props}>
      <path d="M12 3a9 9 0 1 0 9 9 3 3 0 0 1-3-3 3 3 0 0 1-3-3 3 3 0 0 1-3-3Z" />
      <circle cx="9.5" cy="10.5" r="0.7" fill="currentColor" />
      <circle cx="13.5" cy="15.5" r="0.7" fill="currentColor" />
      <circle cx="8.5" cy="15" r="0.7" fill="currentColor" />
    </svg>
  );
}
