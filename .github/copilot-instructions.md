<!-- Copilot / AI-agent instructions for MathUp -->
# MathUp — AI Coding Assistant Guide

Purpose: Short, actionable notes to make an AI coding agent productive immediately.

- Dev: `npm install` then `npm run dev` (Vite). Build: `npm run build`.
- On Windows you can also run `baslat.bat` if present for a wrapped dev start.

Where to look first
- `src/hooks/useDatabase.js` — central persistence (IndexedDB via `idb`). CRUD helpers, schema and `DB_VERSION` live here.
- `src/App.jsx` and `src/main.jsx` — routing, auth gating and app entry.
- `src/utils/helpers.js` — locale (`tr-TR`) utilities, LGS domain logic (net calculation, weeks-to-LGS), and UI helpers.
- `src/components/` — feature pages grouped: `auth`, `students`, `exams`, `books`, `dashboard`, `finance`, `layout`.
- `src/data/curriculum.json` — static curriculum used by dashboard components.

Architecture notes (quick)
- SPA: Vite + React Router v6. Auth gating in `App.jsx` redirects to `/login` when `teacher` is null.
- Client-only persistence: all app data lives in IndexedDB via `useDatabase`. Common stores: `students`, `books`, `exams`, `errorAnalysis`, `teacher`.
- Teacher record is stored under id `'current'` (use `saveTeacher` / `getTeacher`).
- Styling: Tailwind CSS. Helpers often return Tailwind class strings (see `generatePastelColor`).

Project-specific conventions
- Locale: use `tr-TR` formatting in helpers and UI (dates, currency, pluralization).
- LGS logic lives in `utils/helpers.js` and uses domain-specific assumptions (e.g., wrong/3 deduction in `calculateNet`). Don't change these without confirming UX expectations.
- IndexedDB migrations: bump `DB_VERSION` in `useDatabase.initDB` and add migration branches inside the `upgrade` callback. Example: add `db.createObjectStore('newStore')` and handle data migrations there.

Integration points & dependencies
- `idb` — wrapper for IndexedDB (see `useDatabase.js`). Mock or abstract for unit tests.
- `react-router-dom` v6 for routing.
- `chart.js` + `react-chartjs-2` used in finance/report components.

Quick tasks an AI agent will commonly perform
- Add a new persisted field: update `useDatabase` (bump `DB_VERSION` + `upgrade`), migrate existing data, then update components that read/write it (`StudentForm.jsx`, `StudentDetail.jsx`, etc.).
- Change date/currency formatting: update `src/utils/helpers.js` and run the app to verify `tr-TR` output.
- Adjust routes or guards: update `App.jsx` and ensure redirect to `/login` still works when `teacher` is missing.

Files to inspect for context/examples
- `src/hooks/useDatabase.js` — schema, CRUD helpers, migrations.
- `src/App.jsx` — route structure and auth gating.
- `src/utils/helpers.js` — domain rules, locale logic.
- `src/components/students/StudentForm.jsx` — example of forms + persistence usage.

If you want, I can:
- produce a sample `DB_VERSION` migration snippet for `useDatabase.initDB`;
- add unit-test stubs that mock `idb` for headless CI;
- or expand any section above with concrete code examples.

If anything looks missing or unclear, tell me which area to expand.
