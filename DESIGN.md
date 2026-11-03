# Schooling — design rules

Source of truth: Figma "WDS — Khai — School-Management-App" → page 06 Hi-fi
(colour variables "Schooling tokens", Light + Dark modes; components; screens).
In code: the CSS variables at the top of `src/styles.css` (same names, kebab-case).

## Colour — palette A · Classroom Blue
Evolves Khai's own blue (#007bff) and cyan from the first HTML version.

| Role | Light | Dark | Use |
|---|---|---|---|
| `--primary` | #1D5FD1 | #7AA7FF | buttons, links, active tab, focus |
| `--accent` / `--accent-ink` | #0B7F91 / #08697A | #3CC6D9 | time only: the Now / Next lesson, today's column, class markers (`--accent-ink` for text on the accent tint) |
| `--bg` / `--surface` / `--surface-2` | #F6F8FB / #FFF / #EEF2F7 | #0B1220 / #121A2B / #1A2438 | page / cards / fills |
| `--text` / `--muted` | #0F172A / #526079 | #E6EBF3 / #9AA7BD | all text (both pass AA on every surface) |
| success / warning / danger | green / amber / red + soft backgrounds | lighter versions | status only (handed in, late, absent) |

Rules: blue means "you can act here" (buttons, links, the selected menu item) and is
not used for labels or numbers; one solid primary button per area; the accent marks time
("Now", "Next", today) and nothing else; badges that aren't a status are grey. Dark mode has no shadows and uses the
soft primary for big blocks (class banner) so nothing glares.

## Type
- **Plus Jakarta Sans** (headings, 600–800): rounded, friendly, reads young without
  being childish — right for a school app used by 11–18-year-olds.
- **Inter** (body, 400–600): built for screens, clear at small sizes in dense lists
  (registers, gradebooks). Headings and body differ in weight and size, not just family.
- Sizes: page title 30px (24px on phones), section 20px, card title 17px, reading text
  15px (announcements, instructions, messages), UI text 14px, small 12px.
  **Nothing below 12px.** Form fields are 16px on phones (stops iOS zooming in).

## Shape and space
Radius 8px (controls) / 12px (cards) / 16px (banner); 4px spacing steps; content
column max 760px (1040px for Home, Timetable and the class pages).

## Signature component
The **Today strip** on Home: today's lessons in time order; the current or next one
is filled with the accent tint and labelled NOW / NEXT; finished lessons sit on a grey
fill labelled DONE (still full contrast). On phones each lesson is one compact row.

## Layout
Desktop: top bar · grouped side menu (Learn, Schedule, Talk, Records, Admin) · main ·
Classrooms column (Khai's own idea). Under 1180px the classrooms column hides; under
960px the menu becomes icons (with tooltips); the timetable switches to one day at a time
whenever the main column is under 760px; under 760px: classroom chips under the top bar and a
bottom tab bar (Home, Classes, Work, Messages, More).

## States
Every list has an empty state in plain words, a loading line and an error note.
Deletes always ask first. Focus: a 2px solid primary outline, 2px offset, on every control.
Dates: one style everywhere, "Thu 5 Nov, 23:59" (24-hour, no year unless it's another
year); due dates add "in 2 days" / "tomorrow".
The Today strip shows today's lessons while any are left, then the next school day's.
