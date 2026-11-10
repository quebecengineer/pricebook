# Pricebook

A private, offline-first grocery price tracker. Log what you pay; see, at a glance, the cheapest store you've ever found for each item.

- **Instant answer:** an alphabetical, searchable list of every item with its all-time lowest unit price (per kg, L or piece) and where you found it.
- **Honest best price:** the best only drops when a new price is strictly cheaper per unit. Edit or delete an entry and the best recalculates.
- **Works with zero signal:** after the first visit, the app loads and saves entirely offline (installable PWA, data in IndexedDB).
- **Zero cost, no server:** hosted on GitHub Pages. Optional sync keeps one `pricebook.json` in your own Google Drive.

## Use

1. Tap **Log Price** in the bottom toolbar, or the **+** on an item's row. Pick a recent store chip, type the price (and optionally the pack size), and the sheet tells you whether it beats your best before you tap **Save**. The sheet stays open, with the same store, for the next item; **Done** closes it.
2. At checkout, search the list. Tap an item for its all-time best, a comparison of the latest price at each store, and the full history. Tap a history entry to correct it; **Edit** reveals delete, rename and Delete Item (all undoable).
3. **Settings** has currency, Drive sync, backup export/import, store rename/merge, and install/offline-storage status.

The interface follows Apple's Human Interface Guidelines (large titles, inset grouped lists, modal sheets) and respects your text size, dark mode and reduced-motion settings.

Install it from the browser menu ("Add to Home screen" / "Install app") so storage is kept long-term.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + tests + production build
```

## Deploy to GitHub Pages

1. Push this repo to GitHub with a `main` branch.
2. **Settings → Pages → Source:** GitHub Actions.
3. Optional sync: add the repository variable `VITE_GOOGLE_CLIENT_ID` (see below). Without it the app works fully, minus Drive sync.

Every push to `main` runs typecheck, tests and build, then deploys.

## Google Drive sync setup (free, once)

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Drive API**.
2. **OAuth consent screen:** choose External, keep it in **Testing**, and add your Google account as a test user. The only scope used is `drive.file` (non-sensitive): the app can see only files it created.
3. **Credentials → Create OAuth client ID → Web application.** Authorized JavaScript origins:
   - `https://<your-user>.github.io`
   - `http://localhost:5173` (for development)
4. Copy the client ID into the GitHub repository variable `VITE_GOOGLE_CLIENT_ID` (or into `.env.local` for development).

### How sync behaves

- Each sync downloads `pricebook.json`, merges record by record (newest edit wins, deletes included), saves locally, and uploads only if Drive was missing something.
- It runs a few seconds after each change, when the device comes back online, when the app is hidden, and on demand.
- Google issues browser apps a token that lasts about an hour and is kept in memory only. After the app restarts, the header chip shows **Tap to sync**.
- If the Drive file is damaged, sync stops with an error instead of merging it. Delete the file in Drive and the next sync recreates it from your device.

## Known platform limits

- **iOS home-screen app:** Google's sign-in popup can fail inside an installed iOS web app. Connect Drive from Safari, or use Export/Import.
- **Safari storage:** Safari may clear data for sites unused for 7 days unless the app is installed. Install it and keep sync on as a backup.

## Structure

| Path | Role |
| --- | --- |
| `src/model.ts` | Types and pure rules: best price, latest per store, list rows |
| `src/units.ts` | Unit conversion, parsing and formatting |
| `src/db.ts` | IndexedDB access (one transaction per change) |
| `src/state.ts` | App state and actions: log, edit, delete/undo, rename/merge |
| `src/sync/merge.ts` | Validation of untrusted files and last-write-wins merge |
| `src/sync/drive.ts` | Google sign-in and Drive REST calls |
| `src/sync/sync.ts` | When and how sync runs; status for the UI |
| `src/ui/kit.tsx`, `Bar.tsx`, `Sheet.tsx` | HIG building blocks: grouped rows, fields, chips, segmented control, navigation bar, modal sheet |
| `src/ui/*` | Screens: list, log sheet, item detail, settings |
| `src/tokens.css` | Design tokens: system colors (WCAG AA), Dynamic Type scale, radii, materials |

Icons are adapted from [Lucide](https://lucide.dev) (ISC license).
