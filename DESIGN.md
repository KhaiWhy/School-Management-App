# Schooling — design rules

Source of truth: Figma "WDS — Khai — School-Management-App" → page 06 Hi-fi
(colour variables "Schooling tokens", Light + Dark modes; components; screens).
In code: the CSS variables at the top of `src/styles.css` (same names, kebab-case).

## Colour — Khai's sage greens
Khai picked #5C7057 and #89A482 (4 Nov 2026) to replace the first blue; white stays.

| Role | Light | Dark | Use |
|---|---|---|---|
| `--primary` | **#5C7057** | **#89A482** | buttons, links, active tab, focus |
| `--accent` | **#89A482** | #89A482 | time and class markers: the Now / Next lesson, today's column, dots, tints |
| `--accent-ink` | #4B6745 | #A9C2A2 | any text or icon in the accent colour (#89A482 is only 2.7:1 on white, so it is never used for text) |
| `--bg` / `--surface` / `--surface-2` | #F6F7F4 / #FFF / #EEF1EC | #0F1310 / #161C17 / #1E2620 | page / cards / fills |
| `--text` / `--muted` | #172017 / #56604F | #E7ECE5 / #A3AE9F | all text (both pass AA on every surface) |
| `--field-border` | #7F8B7B | #6E7D6C | input edges (3:1) |
| success / warning / danger | green / amber / red + soft backgrounds | lighter versions | status only (handed in, late, absent) |

Rules: the primary green means "you can act here" (buttons, links, the selected menu item) and is
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
