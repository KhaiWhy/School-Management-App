// Small stroke icons for the side rail. Add a path here to add an icon.
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
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  people: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 3-5 6-5s6 2 6 5M17 11a2.5 2.5 0 100-5M18 15c2 .5 3 2 3 5',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5',
  send: 'M4 12l16-8-6 16-3-6z',
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
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
