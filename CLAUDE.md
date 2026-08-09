# CLAUDE.md

## Project overview

JakeOS is a personal dashboard built with Angular 21, living in `frontend/`.
The app is organised by feature: each feature folder under `frontend/src/app/`
(`dashboard/`, `tasks/`, `habits/`, `journal/`) holds its standalone page
component plus its model, service, and service spec. Cross-cutting pieces
(`ThemeService`, date utils) live in `core/`. Data persists to browser
localStorage via the services. Theming
is four palettes (oat, dusk, ink, candlelit) defined as CSS custom properties
in `frontend/src/styles.css` and switched by `ThemeService` setting
`data-theme` on `<html>` — components must only reference the tokens, never
raw colors.

## Commands

Run from `frontend/`:

- `npm start` — dev server on http://localhost:4200 (often already running)
- `ng build --configuration development` — quick compile check

## Rules

- Use Angular's built-in control flow (`@if` / `@else`, `@for` / `@empty`,
  `@switch`) in templates — never the deprecated `*ngIf`, `*ngFor`, `*ngSwitch`.
- Simple but *right*: never silently loosen types or validation relative to an
  existing model/contract (e.g. backend schemas must mirror the frontend models
  in `frontend/src/app/*/`*.model.ts`). If simplifying deliberately, say so
  explicitly in the same message the code is introduced.
- Prioritise readability, with judgement: extract a named, typed intermediate
  when an expression is bulky or multi-part (e.g. an object literal passed to
  `http.post` becomes a typed `requestBody`); keep trivial single values
  inline. Shapes that cross the frontend/backend boundary get a named type in
  the feature's model file. The test is "does the name reveal intent?", not
  "is everything extracted?".