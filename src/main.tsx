import { render } from 'preact'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app'
import { load } from './state'
import { startSync } from './sync/sync'
import { toast } from './ui/Toast'
import './styles.css'

render(<App />, document.getElementById('app')!)
void navigator.storage?.persist?.()
load().then(startSync, console.error)

const update = registerSW({
  onNeedRefresh: () =>
    toast('A new version is ready', { sticky: true, action: { label: 'Reload', run: () => void update(true) } }),
})
