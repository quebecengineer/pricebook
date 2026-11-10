/* Paths adapted from Lucide (ISC license, lucide.dev). Circles are written as arcs so each icon is one path. */
const RING = 'M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0'
const CLOUD = 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'

const PATHS = {
  'chevron-left': 'm15 18-6-6 6-6',
  'chevron-right': 'm9 18 6-6-6-6',
  'plus-circle': `${RING}M8 12h8M12 8v8`,
  'minus-circle': `${RING}M8 12h8`,
  search: 'M19 11a8 8 0 1 1-16 0a8 8 0 1 1 16 0M21 21l-4.3-4.3',
  'x-circle': `${RING}m15 9-6 6m0-6 6 6`,
  settings:
    'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0',
  'cloud-check': `${CLOUD}m-8.5-4.5 2 2 4-4`,
  'cloud-off': `${CLOUD}M2 2l20 20`,
  refresh: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8M21 3v5h-5',
  alert: `${RING}M12 8v4m0 4h.01`,
  clock: `${RING}M12 6v6l4 2`,
  'trending-down': 'M16 17h6v-6m0 6-8.5-8.5-5 5L2 7',
  tag: 'M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42zM7.5 7.5h.01',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 22, class: cls = '' }: { name: IconName; size?: number; class?: string }) {
  return (
    <svg
      class={`icon ${cls}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
