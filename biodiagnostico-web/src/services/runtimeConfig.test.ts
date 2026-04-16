import { afterEach, describe, expect, it } from 'vitest'
import {
  normalizeConfiguredApiUrl,
  normalizeConfiguredApiUrlForHostname,
  resolveApiUrl,
} from './runtimeConfig'

afterEach(() => {
  window.__APP_CONFIG__ = undefined
})

describe('runtimeConfig', () => {
  it('ignora placeholder de deploy', () => {
    expect(normalizeConfiguredApiUrl('https://seu-backend.up.railway.app/api')).toBeNull()
  })

  it('ignora localhost em producao remota', () => {
    expect(normalizeConfiguredApiUrlForHostname('http://localhost:8080/api', 'labbio.app')).toBeNull()
  })

  it('mantem URL absoluta valida sem barra final', () => {
    expect(normalizeConfiguredApiUrl('https://api.labbio.app/api/')).toBe('https://api.labbio.app/api')
  })

  it('prefere runtime config sobre build-time', () => {
    window.__APP_CONFIG__ = {
      apiUrl: 'https://api.labbio.app/api',
    }

    if (import.meta.env.DEV) {
      expect(resolveApiUrl()).toBe('/api')
      return
    }

    expect(resolveApiUrl()).toBe('https://api.labbio.app/api')
  })
})
