import type { ReactNode } from "react"

export type IconName =
  | "alert"
  | "arrow"
  | "book"
  | "calendar"
  | "chat"
  | "check"
  | "chevron"
  | "close"
  | "compare"
  | "dock"
  | "download"
  | "external"
  | "globe"
  | "ice"
  | "info"
  | "layers"
  | "link"
  | "menu"
  | "minus"
  | "pause"
  | "pin"
  | "play"
  | "plus"
  | "reset"
  | "search"
  | "send"
  | "shield"
  | "timeline"
  | "water"

const paths: Record<IconName, ReactNode> = {
  alert: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5m0 3h.01" /></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  book: <><path d="M4 5a3 3 0 0 1 3-3h4v17H7a3 3 0 0 0-3 3Z" /><path d="M20 5a3 3 0 0 0-3-3h-4v17h4a3 3 0 0 1 3 3Z" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  chat: <><path d="M20 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  compare: <><path d="M8 4 4 8l4 4M4 8h14" /><path d="m16 20 4-4-4-4m4 4H6" /></>,
  dock: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>,
  download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 20h16" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.4 3 14.6 0 18M12 3c-3 3.4-3 14.6 0 18" /></>,
  ice: <><path d="M12 2v20M4 7l16 10M4 17 20 7" /><path d="m8 4 4 3 4-3m-8 16 4-3 4 3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  layers: <><path d="m12 3-9 5 9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  minus: <path d="M5 12h14" />,
  pause: <path d="M9 5v14M15 5v14" />,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  play: <path d="m8 5 11 7-11 7Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  reset: <><path d="M4 8V3m0 0h5M4 3l4 4" /><path d="M5.4 16a8 8 0 1 0 .5-9.1" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  shield: <><path d="M12 3 4 6v5c0 5.2 3.4 8.5 8 10 4.6-1.5 8-4.8 8-10V6Z" /><path d="m9 12 2 2 4-5" /></>,
  timeline: <><path d="M4 18V6m5 12V9m5 9V4m5 14v-7" /><path d="M2 18h20" /></>,
  water: <path d="M12 3S5 11 5 16a7 7 0 0 0 14 0c0-5-7-13-7-13Z" />,
}

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    >
      {paths[name]}
    </svg>
  )
}
