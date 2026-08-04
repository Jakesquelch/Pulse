# CLAUDE.md

## Project overview

JakeOS is a personal dashboard built with Angular 21, living in `frontend/`.
Pages (dashboard, to-do list, journal, habit tracker) are standalone components
under `frontend/src/app/pages/`, with shared services in `services/` and models
in `models/`. Data persists to browser localStorage via the services. Theming
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