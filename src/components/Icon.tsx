// Stroke icons (same shapes as the Figma Icon/* components). Add a path here to add an icon.
const PATHS = {
  home: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  classroom: 'M4 5h16v11H4zM8 20h8M12 16v4',
  assignment: 'M8 4h8l3 3v13H5V4h3M9 12l2 2 4-4',
  material: 'M4 6h6l2 2h8v11H4z',
  timetable: 'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  activity: 'M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z',
  message: 'M4 5h16v11H9l-5 4z',
  attendance: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 3-5 6-5s6 2 6 5M16 11l2 2 4-4',
  report: 'M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h3',
  people: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 3-5 6-5s6 2 6 5M17 11a2.5 2.5 0 100-5M18 15c2 .5 3 2 3 5',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5',
  send: 'M4 12l16-8-6 16-3-6z',
  moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  plus: 'M12 5v14M5 12h14',
  upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  check: 'M5 12l5 5 9-10',
  more: 'M12 5.5v.01M12 12v.01M12 18.5v.01',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  back: 'M15 6l-6 6 6 6',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  profile: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  merit: 'M12 15a6 6 0 100-12 6 6 0 000 12zM8.5 14l-1.5 7 5-3 5 3-1.5-7',
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more' ? 3 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
