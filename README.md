# Pricebook

A private, offline-first grocery price tracker. Log what you pay; see, at a glance, the cheapest store you've ever found for each item.

- **Instant answer:** an alphabetical, searchable list of every item with its all-time lowest unit price (per kg, L or piece) and where you found it.
- **Honest best price:** the best only drops when a new price is strictly cheaper per unit. Edit or delete an entry and the best recalculates.
- **Search by category, ranked by cost:** "curd", "yogurt" or "greek yogurt" finds every matching item even when its name is just brand noise ("Amul Masti Dahi 1kg"), then ranks them cheapest first by today's price per kg, L or piece. Categorizing is a built-in dictionary (no AI, nothing leaves the device); each item page shows why it got its category and lets you override it.
- **Works with zero signal:** after the first visit, the app loads and saves entirely offline (installable PWA, data in IndexedDB).
- **WhatsApp-style Google Drive backup:** a hidden backup in your own Drive on a schedule you pick, restore on a new phone, and optional end-to-end encryption with a password only you know.
- **Export anywhere:** share a backup file or a CSV spreadsheet through the phone's share sheet (WhatsApp, email, Files).

## Use

1. Tap **Log Price** in the bottom toolbar, or the **+** on an item's row. Pick a recent store chip, type the price (and optionally the pack size), and the sheet tells you whether it beats your best before you tap **Save**. The sheet stays open, with the same store, for the next item; **Done** closes it.
2. At checkout, search the list by item or category. Results rank cheapest first (switch to A–Z above them); tap a category chip to narrow. Tap an item for its all-time best, a comparison of the latest price at each store, and the full history. Tap a history entry to correct it; **Edit** reveals delete, rename and Delete Item (all undoable).
3. **Settings** has currency, Google Drive backup, export/import, store rename/merge, and install/offline-storage status.

The interface follows Apple's Human Interface Guidelines (large titles, inset grouped lists, modal sheets) and respects your text size, dark mode and reduced-motion settings.

Install it from the browser menu ("Add to Home screen" / "Install app") so storage is kept long-term.

## Google Drive backup

Settings → **Google Drive Backup** works like WhatsApp's chat backup:

- **Back Up to Google Drive** signs in once. The backup is one file in Drive's hidden app folder: it doesn't clutter My Drive and only Pricebook can read it.
- **Back Up Every:** every change (the default, and how earlier versions synced), daily, weekly, monthly, or only when you tap **Back Up**. **Last Backup** shows when and how big.
- **New phone:** open Pricebook, tap **Restore from Google Drive**, sign in, and confirm the backup it found. Restoring merges into the phone; it never deletes anything there.
- **Encrypted Backup:** set a password and the backup is encrypted on your device (AES-256-GCM, key derived with PBKDF2-SHA256 at 600,000 iterations) before it reaches Google. Other devices ask for the password once. If you forget it, the backup can't be recovered by anyone.
- **Several devices** share one backup: each run merges record by record (newest edit wins, deletes included) and uploads only if Drive is missing something. A backup the app can't validate or decrypt is never overwritten.
- **Background:** an installed app on Android/Chrome can also back up while closed. On iPhone, backups run whenever the app is open.

How it stays safe: the app never sees a Google token. A small Cloudflare Worker (`worker/`) handles sign-in (authorization code + PKCE) and keeps the tokens sealed in an encrypted, `HttpOnly`, `SameSite=Strict` cookie; it exposes only the one backup file. No API key, client secret or client ID is in the app's code, and CI fails the build if one appears.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173 (backup shows "Not available" without the Worker)
npm run check      # typecheck + tests + production build
```

To try backup locally, put test credentials in `.dev.vars` (git-ignored), run `npm run build && npx wrangler dev`, and open http://localhost:8787. With `npm run dev`, `/api` is proxied to that Worker.

## Deploy (free)

The app and its Worker are served together from Cloudflare, so the sign-in cookie is first-party.

1. **Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com/)): create a project and enable the **Google Drive API**.
   - **OAuth consent screen:** External, scopes `openid`, `email`, `drive.appdata` and `drive.file` (all non-sensitive). Set the publishing status to **In production**: in Testing, Google expires sign-ins after 7 days.
   - **Credentials → OAuth client ID → Web application**, authorized redirect URI `https://<your-worker>.workers.dev/api/auth/callback` (and `http://localhost:8787/api/auth/callback` for development).
2. **Cloudflare** (free plan): `npx wrangler login`, then set the secrets, which never leave Cloudflare:
   ```sh
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put SESSION_KEY   # paste the output of: openssl rand -base64 32
   ```
3. **GitHub repository settings:**
   - Secrets: `CLOUDFLARE_API_TOKEN` (Workers edit permission) and `CLOUDFLARE_ACCOUNT_ID`.
   - Variables: `APP_ORIGIN` = `https://<your-worker>.workers.dev`, and `LEGACY_ORIGIN` = `https://<your-user>.github.io` if people used the GitHub Pages version.
   - **Pages → Source:** GitHub Actions (keeps the old address alive for the move below).

Every push to `main` runs typecheck, tests, the build and the credential scan, then deploys to Cloudflare and GitHub Pages.

## Moving from the GitHub Pages version (no data is lost)

Browsers keep each address's data separately, so the new address starts empty. Existing data is carried over three ways, and the old copy is never deleted:

1. **Move My Prices:** the old address now shows **Pricebook Has Moved**. Tapping **Move My Prices** opens the new address and hands everything over (the two pages check each other's exact origin; the new one validates and merges the data).
2. **Google Drive:** if you synced with the earlier version using this Google project, the first backup at the new address merges the old visible `pricebook.json` in. You can delete that file from My Drive afterwards.
3. **By hand:** Settings → **Share Backup** at the old address, then **Import Backup** at the new one.

On the same address, updating keeps everything: the local database upgrade only adds a store for the backup key, and if you had Drive sync on, Settings shows **Reconnect Google Drive** once.

## Known platform limits

- **Safari storage:** Safari may clear data for sites unused for 7 days unless the app is installed. Install it and keep backup on.
- **Pop-ups:** **Move My Prices** opens a new tab; if the browser blocks it, allow pop-ups or use Share Backup and Import.
- **Background backup** needs Chrome or Edge with the app installed; elsewhere backups run while the app is open.

## Structure

| Path | Role |
| --- | --- |
| `src/model.ts` | Types and pure rules: best price, latest per store, list rows |
| `src/units.ts` | Unit conversion, parsing (including pack sizes in names) and formatting |
| `src/taxonomy.ts` | Category tree and the words that name each category (data only) |
| `src/categories.ts` | Deterministic categorizing (longest phrase, head noun) and category-aware search |
| `src/db.ts` | IndexedDB access (one transaction per change) and the stored backup key |
| `src/state.ts` | App state and actions: log, edit, delete/undo, rename/merge |
| `src/export.ts` | CSV export and the share sheet |
| `src/move.ts` | Hand-off of data from the old address to the new one |
| `src/sync/merge.ts` | Validation of untrusted files and last-write-wins merge |
| `src/sync/drive.ts` | Same-origin client for the Worker's API |
| `src/sync/crypto.ts` | End-to-end encryption of backups |
| `src/sync/backup.ts` | One backup run: fetch, validate, merge, seal, upload (shared with the service worker) |
| `src/sync/sync.ts` | Schedule, status, restore and password actions for the UI |
| `src/sw.ts` | Service worker: offline cache and background backup |
| `worker/` | Cloudflare Worker: Google sign-in, sealed session cookie, the one backup file |
| `src/ui/kit.tsx`, `Bar.tsx`, `Sheet.tsx` | HIG building blocks: grouped rows, fields, chips, segmented control, navigation bar, modal sheet |
| `src/ui/*` | Screens: list, log sheet, item detail, settings, backup, restore, password, move |
| `src/tokens.css` | Design tokens: system colors (WCAG AA), Dynamic Type scale, radii, materials |

Icons are adapted from [Lucide](https://lucide.dev) (ISC license).
