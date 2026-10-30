# Meal Planner 1.3.0

## Meal visibility
- Each calendar occurrence can be hidden or restored without changing the immutable `.diet` source.
- Hidden meals are omitted from the personal daily nutrition summary.
- Hidden meals are omitted from generated shopping ingredients only when shopping mode is `advanced`; one-person and two-person projections keep their original behavior.
- The hidden flag is stored in app state/backups and remains reversible from the planner.

## Meal swap
- A new interactive modal exchanges two calendar occurrences.
- The selected meal stays visible in a compact left rail; the right workspace browses calendar dates and scrolls candidate meals vertically.
- Candidate cards show meal type, time, kcal and a compact comma-separated ingredient preview.
- Selecting a candidate previews only the kcal/protein/fat/carbohydrate delta for each affected day; no nutritional rule blocks the swap.
- Confirming exchanges effective date and time while preserving source identity, cooking servings, visibility and other occurrence metadata. Workday context remains attached to calendar dates.

## UI
- Desktop swap layout uses an approximate 20/80 split and collapses responsively on mobile.
- Candidate cards use lightweight tilt/elastic feedback and respect reduced-motion preferences.

## Verification
- `npm run check`, `npm run build` and `npm run verify:build` pass in the delivery environment.
- Three focused data tests pass for visibility, Advanced shopping, backup persistence and same/cross-day swaps.
- The full project requires Node >=24. The delivery environment exposes Node 22; several IndexedDB test files could not start because the local `fake-indexeddb` installation was incomplete. GitHub Actions remains the authoritative Node 24 suite.
