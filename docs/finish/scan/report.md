# Finish scan

Date: 2026-10-18T07:48:43.628Z  Base: http://localhost:5173  Source: src
High: 3 · medium: 1 · low: 1. Findings are evidence for the finish inventory, not verdicts.

- Pages: 1 at 1440 px; unknown URL answered 200; 1 internal link targets.
- Source: 22 files scanned under src, 1 lines flagged (at most five per rule per file).
- Click probe: 24 controls clicked on 1 pages: 2 with no visible effect, 0 skipped (risky label or submit button: check them by hand), 0 unstable, 0 not clickable.

## High

- [no-404] (unknown URL): an unknown URL renders the start page with status 200
- [no-effect] / · button: "Оновити" did nothing visible: no navigation, change on the page, request or focus move
- [no-effect] / · button: "Кількість" did nothing visible: no navigation, change on the page, request or focus move

## Medium

- [placeholder-contact] (source) · src/components/Admin.tsx:358: placeholder="https://api.example.com/dashboard"

## Low

- [no-open-graph] / · og:title, og:image: missing
