// The Workers runtime treats every named export of this entry module as a handler, so it exports nothing else.
import { handle } from './routes'

export default { fetch: handle }
