import { describe, expect, it } from 'vitest'
import { isClientId } from '../src/sync/drive'

describe('isClientId', () => {
  it('accepts a Google OAuth web client ID', () => {
    expect(isClientId('123456789012-abc123def456ghi789jkl012mno345pq.apps.googleusercontent.com')).toBe(true)
  })
  it.each(['', 'AIzaSyD-an-api-key', 'GOCSPX-a-client-secret', 'x.apps.googleusercontent.com.evil.com'])(
    'rejects %s',
    (id) => expect(isClientId(id)).toBe(false),
  )
})
