interface ImportMetaEnv {
  /** Where the app now lives, e.g. https://pricebook.example.workers.dev. Not a secret. */
  readonly VITE_APP_ORIGIN?: string
  /** The address it used to live at (GitHub Pages), allowed to hand its data over. Not a secret. */
  readonly VITE_LEGACY_ORIGIN?: string
}
