/**
 * Tab-seat tests (`tab-seat.ts`): the DOM injection that puts the strip at the
 * head of the conversation column.
 *
 * These cover the two behaviours the injection exists for — finding the column
 * that declares no slot, and surviving React re-rendering that column's child
 * list — plus the teardown contract. The column is matched by the `_centerCol`
 * class suffix the CSS-Modules transform preserves, so the tests build nodes
 * with a realistic hash prefix rather than the literal class.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountTabSeat } from '../src/client/tab-seat.ts'

/** Build a stand-in conversation column with ui-layout's hashed class shape. */
function column(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pI_x6G_centerCol'
  return el
}

/** Let queued microtasks and the mutation observer callback run. */
async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('mountTabSeat', () => {
  it('seats the container as the FIRST child of the column', async () => {
    const col = column()
    const panel = document.createElement('div')
    panel.textContent = 'transcript'
    col.append(panel)
    document.body.append(col)

    const ready = vi.fn()
    const seat = mountTabSeat(ready)

    expect(seat.host).not.toBeNull()
    expect(col.firstChild).toBe(seat.host)
    expect(col.children[1]).toBe(panel)
    expect(ready).toHaveBeenCalledTimes(1)

    seat.dispose()
  })

  it('waits for the column to mount, then seats into it', async () => {
    const ready = vi.fn()
    const seat = mountTabSeat(ready)
    // Nothing in the DOM yet: the seat reports no host and stays unseated.
    expect(seat.host).toBeNull()
    expect(ready).not.toHaveBeenCalled()

    const col = column()
    document.body.append(col)
    await settle()

    expect(seat.host).not.toBeNull()
    expect(col.firstChild).toBe(seat.host)
    expect(ready).toHaveBeenCalledTimes(1)

    seat.dispose()
  })

  it('re-seats the SAME element after React drops it', async () => {
    const col = column()
    document.body.append(col)

    const seat = mountTabSeat(() => {})
    const host = seat.host
    expect(col.firstChild).toBe(host)

    // Simulate React reconciling the column's children and dropping our node.
    host?.remove()
    expect(col.firstChild).toBeNull()
    await settle()

    // Same element, re-inserted at the head: a portal keeps its subtree and
    // React state, which a freshly created node would lose.
    expect(col.firstChild).toBe(host)
    expect(seat.host).toBe(host)

    seat.dispose()
  })

  it('is idempotent: repeated mutation callbacks cause no DOM churn', async () => {
    const col = column()
    document.body.append(col)

    const seat = mountTabSeat(() => {})
    const host = seat.host

    // An unrelated mutation elsewhere still routes through the observer.
    for (let i = 0; i < 3; i += 1) {
      document.body.append(document.createElement('span'))
      await settle()
    }

    expect(col.querySelectorAll('[data-wg-tab-seat]')).toHaveLength(1)
    expect(col.firstChild).toBe(host)

    seat.dispose()
  })

  it('reports a DEEP column: a nested seat does not shadow the real column', async () => {
    // The frame is nested inside the app root; the class probe must still find
    // the column wherever the shell mounts it.
    const appRoot = document.createElement('div')
    const frame = document.createElement('div')
    const col = column()
    frame.append(col)
    appRoot.append(frame)
    document.body.append(appRoot)

    const seat = mountTabSeat(() => {})
    expect(col.firstChild).toBe(seat.host)

    seat.dispose()
  })

  it('dispose removes the container and stops watching', async () => {
    const col = column()
    document.body.append(col)

    const seat = mountTabSeat(() => {})
    const host = seat.host
    seat.dispose()

    expect(host?.isConnected).toBe(false)
    expect(col.querySelector('[data-wg-tab-seat]')).toBeNull()

    // No resurrection after disposal: a later column appearing is ignored.
    const late = column()
    document.body.append(late)
    await settle()
    expect(late.querySelector('[data-wg-tab-seat]')).toBeNull()
  })

  it('removes its container when the column itself is torn down', async () => {
    const col = column()
    document.body.append(col)

    const seat = mountTabSeat(() => {})
    col.remove()
    await settle()

    // With no column left there is nothing to attach to; the seat must not
    // linger as a detached node holding a live portal.
    expect(seat.host?.isConnected).toBe(false)

    seat.dispose()
  })
})
