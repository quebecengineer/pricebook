import { render } from 'preact'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app'
import { watchInstall } from './install'
import { load } from './state'
import { startSync } from './sync/sync'
import { toast } from './ui/Toast'
import './styles.css'

render(<App />, document.getElementById('app')!)
watchInstall()
load().then(startSync, console.error)

const update = registerSW({
  onNeedRefresh: () =>
    toast('A new version is ready', { sticky: true, action: { label: 'Reload', run: () => void update(true) } }),
})
