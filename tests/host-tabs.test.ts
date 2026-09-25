/**
 * Host-side tab persistence tests (`host-tabs.ts`).
 *
 * This layer fixes the reported bug: browser storage is scoped to the ORIGIN
 * (which includes the port), and every launch picks a new port, so tabs kept in
 * the browser start empty next time. The host file is port-independent, and the
 * read is NOT gated by any browser-session marker — a marker would itself live
 * in per-origin storage and therefore erase the tabs on every restart.
 */
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  documentForTabs,
  parseTabsDocument,
  readTabsDocument,
  writeTabsDocument,
} from '../src/host-tabs.ts'

let dir: string
let file: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'wg-tabs-'))
  file = join(dir, 'nested', 'workspace-groups.tabs.json')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const doc = (tabs: { sessionId: string; order: number }[], order = tabs.length) =>
  documentForTabs({ order, tabs })

describe('readTabsDocument / writeTabsDocument', () => {
  it('treats a missing file as "no tabs" rather than an error', async () => {
    // First run has no sidecar; that is normal, not a failure.
    expect(await readTabsDocument(file)).toBeNull()
  })

  it('round-trips through the filesystem, creating parent directories', async () => {
    await writeTabsDocument(file, doc([{ sessionId: 'a', order: 1 }]))
    const loaded = await readTabsDocument(file)
    expect(loaded?.tabs).toEqual([{ sessionId: 'a', order: 1 }])
  })

  it('preserves arrival ORDER of the tabs', async () => {
    await writeTabsDocument(file, doc([
      { sessionId: 'z', order: 9 },
      { sessionId: 'a', order: 2 },
    ]))
    // Array order is the strip's order; `order` is only a React key.
    expect((await readTabsDocument(file))?.tabs.map(t => t.sessionId)).toEqual(['z', 'a'])
  })

  it('reads a corrupt file as null so the next write repairs it', async () => {
    await writeTabsDocument(file, doc([{ sessionId: 'a', order: 1 }]))
    await writeFile(file, '{not json', 'utf8')
    expect(await readTabsDocument(file)).toBeNull()
  })

  it('writes valid JSON with a trailing newline', async () => {
    await writeTabsDocument(file, doc([{ sessionId: 'a', order: 1 }]))
    const text = await readFile(file, 'utf8')
    expect(text.endsWith('\n')).toBe(true)
    expect(() => JSON.parse(text)).not.toThrow()
  })

  it('leaves no temp files behind', async () => {
    await writeTabsDocument(file, doc([{ sessionId: 'a', order: 1 }]))
    expect(await readdir(join(dir, 'nested'))).toEqual(['workspace-groups.tabs.json'])
  })
})

describe('the persisted strip is returned verbatim (no session gating)', () => {
  it('returns the tabs on EVERY read, whatever the port or session', async () => {
    // The regression: a session marker lived in sessionStorage, which the port
    // change erased, so a restart looked like a new session and the tabs were
    // silently discarded. Reading back must not depend on any caller identity.
    await writeTabsDocument(file, doc([{ sessionId: 'kept', order: 1 }]))
    const loaded = await readTabsDocument(file)
    expect(loaded?.tabs).toEqual([{ sessionId: 'kept', order: 1 }])
  })

  it('tolerates a file written by the older marker-based build', async () => {
    // An existing sidecar carries `sessionKey`; the new reader ignores it rather
    // than rejecting the file, so nobody's tabs are lost by this change.
    await writeFile(file, JSON.stringify({
      version: 1,
      sessionKey: 'legacy-browser-session',
      order: 2,
      tabs: [{ sessionId: 'from-old-build', order: 2 }],
    }), 'utf8').catch(async () => {
      await writeTabsDocument(file, doc([{ sessionId: 'from-old-build', order: 2 }]))
      await writeFile(file, JSON.stringify({
        version: 1,
        sessionKey: 'legacy-browser-session',
        order: 2,
        tabs: [{ sessionId: 'from-old-build', order: 2 }],
      }), 'utf8')
    })
    const loaded = await readTabsDocument(file)
    expect(loaded?.tabs).toEqual([{ sessionId: 'from-old-build', order: 2 }])
  })
})

describe('documentForTabs', () => {
  it('never lets the counter fall behind a stored key', () => {
    // A stale counter would let a future tab reuse an existing key, which makes
    // React move a chip's DOM node instead of reconciling it.
    expect(documentForTabs({ order: 2, tabs: [{ sessionId: 'a', order: 40 }] }).order).toBe(40)
  })

  it('keeps a counter already ahead of every tab', () => {
    expect(documentForTabs({ order: 9, tabs: [{ sessionId: 'a', order: 3 }] }).order).toBe(9)
  })
})

describe('parseTabsDocument', () => {
  it('rejects a foreign or older shape', () => {
    const bad = [
      null,
      'string',
      [],
      { version: 2, order: 0, tabs: [] },
      { version: 1, order: 0 },                    // no tabs
      { version: 1, order: Number.NaN, tabs: [] },
    ]
    for (const value of bad) expect(parseTabsDocument(value)).toBeNull()
  })

  it('drops bad rows but keeps good ones', () => {
    const parsed = parseTabsDocument({
      version: 1,
      order: 3,
      tabs: [
        { sessionId: 'good', order: 1 },
        { sessionId: 42, order: 2 },
        { sessionId: '', order: 3 },
        { sessionId: 'no-order' },
        null,
      ],
    })
    expect(parsed?.tabs).toEqual([{ sessionId: 'good', order: 1 }])
  })

  it('collapses a duplicated session id to one tab', () => {
    // Two chips for one conversation would break the one-tab-per-session rule.
    const parsed = parseTabsDocument({
      version: 1,
      order: 3,
      tabs: [
        { sessionId: 'dup', order: 1 },
        { sessionId: 'dup', order: 2 },
      ],
    })
    expect(parsed?.tabs).toEqual([{ sessionId: 'dup', order: 1 }])
  })
})
