import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import { Canvas } from './Canvas'

/**
 * Pointer lock is requested by the main thread synchronously in the canvas click listener (a browser
 * accepts requestPointerLock only inside a user gesture). The `pointerLock` prop decides whether a click
 * requests it; the host turns it off while its in-scene toolbar owns the pointer, so the prop changes on
 * every hover of the toolbar. Such a change must only add or remove the click listener: the event
 * forwarding, the resize observer and the worker channel stay as they are.
 */

vi.mock('@react-three/fiber', () => ({ Canvas: () => null }))

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const observe = vi.fn()
const requestPointerLock = vi.fn()
let addEventListener: MockInstance<(type: string, listener: EventListenerOrEventListenerObject) => void>
let container: HTMLDivElement
let root: Root
const postMessage = vi.fn<(message: { type?: string }) => void>()
const worker = { postMessage, onmessage: null } as unknown as Worker

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = observe
      disconnect = vi.fn()
    }
  )
  HTMLCanvasElement.prototype.transferControlToOffscreen = vi.fn(() => ({}) as OffscreenCanvas)
  HTMLCanvasElement.prototype.requestPointerLock = requestPointerLock
  addEventListener = vi.spyOn(HTMLCanvasElement.prototype, 'addEventListener') as typeof addEventListener
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  addEventListener.mockRestore()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function renderCanvas(pointerLock: boolean): void {
  act(() => root.render(<Canvas worker={worker} pointerLock={pointerLock} />))
}

function click(): void {
  container.querySelector('canvas')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

const pointerDownSubscriptions = (): number =>
  addEventListener.mock.calls.filter(([eventName]: [string, EventListenerOrEventListenerObject]) => eventName === 'pointerdown').length

describe('Canvas pointer lock on click', () => {
  it('requests pointer lock on a click while pointerLock is true', () => {
    renderCanvas(true)
    click()
    expect(requestPointerLock).toHaveBeenCalledTimes(1)
  })

  it('does not request pointer lock on a click while pointerLock is false', () => {
    renderCanvas(false)
    click()
    expect(requestPointerLock).not.toHaveBeenCalled()
  })

  it('follows every change of pointerLock', () => {
    renderCanvas(true)
    renderCanvas(false)
    click()
    expect(requestPointerLock).not.toHaveBeenCalled()

    renderCanvas(true)
    click()
    expect(requestPointerLock).toHaveBeenCalledTimes(1)
  })

  it('keeps the event forwarding, the resize observer and the worker init when pointerLock changes', () => {
    renderCanvas(true)
    renderCanvas(false)
    renderCanvas(true)

    expect(pointerDownSubscriptions()).toBe(1)
    expect(observe).toHaveBeenCalledTimes(1)
    const inits = postMessage.mock.calls.filter(([message]: [{ type?: string }]) => message.type === 'init')
    expect(inits).toHaveLength(1)
  })
})
