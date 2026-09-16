/**
 * open-in-app transport tests: which catalog id counts as this host's file
 * manager (per-platform preference, absent when the host resolved none), the
 * availability read's tolerance of a missing capability, and the launch POST
 * payload/refusal mapping.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fetchOpenInApps,
  folderAppId,
  openPathInApp,
  OPEN_IN_APP_APPS_ROUTE,
  OPEN_IN_APP_OPEN_ROUTE,
} from '../src/client/open-folder.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('folderAppId', () => {
  it('prefers the platform file manager the host resolved', () => {
    expect(folderAppId(['cursor', 'explorer', 'terminal'])).toBe('explorer')
    expect(folderAppId(['finder', 'vscode'])).toBe('finder')
    expect(folderAppId(['filemanager'])).toBe('filemanager')
  })

  it('returns undefined when no file manager was resolved', () => {
    expect(folderAppId([])).toBeUndefined()
    expect(folderAppId(['vscode', 'terminal', 'gitbash'])).toBeUndefined()
  })
})

describe('fetchOpenInApps', () => {
  it('reads the probed ids and keeps only strings', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ apps: ['explorer', 42, 'terminal'] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchOpenInApps()).toEqual(['explorer', 'terminal'])
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(OPEN_IN_APP_APPS_ROUTE)
  })

  it('reads a malformed payload as no applications instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ apps: 'nope' }), { status: 200 }),
    ))
    expect(await fetchOpenInApps()).toEqual([])
  })

  it('rejects when the host refuses the read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })))
    await expect(fetchOpenInApps()).rejects.toThrow('401')
  })
})

describe('openPathInApp', () => {
  it('posts the app id and the absolute directory', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await openPathInApp('explorer', 'C:\\xhl\\agent-work')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain(OPEN_IN_APP_OPEN_ROUTE)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ app: 'explorer', path: 'C:\\xhl\\agent-work' })
  })

  it('rejects when the host refuses the launch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 502 })))
    await expect(openPathInApp('explorer', 'C:\\nope')).rejects.toThrow('502')
  })
})
