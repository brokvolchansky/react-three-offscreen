import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getKeyboardState, handleKeyboardEvent, isKeyPressed, onKeyboardEvent } from './keyboard'

/**
 * The keyboard state manager is the worker-side half of the input bridge: the main thread forwards
 * raw keyboard events, this module keeps the pressed set and hands the render loop a snapshot.
 * Everything below is behaviour the render loop depends on — a wrong answer here shows up as a
 * character that keeps walking after the key was released, or as a key that never registers.
 */

/** The state lives in module scope, so every case starts from the cleared state. */
beforeEach(() => {
  handleKeyboardEvent({ eventName: 'blur' })
})

describe('key state', () => {
  it('tracks press and release by KeyboardEvent.code', () => {
    handleKeyboardEvent({ eventName: 'keydown', key: 'w', code: 'KeyW' })
    expect(isKeyPressed('KeyW')).toBe(true)

    handleKeyboardEvent({ eventName: 'keyup', key: 'w', code: 'KeyW' })
    expect(isKeyPressed('KeyW')).toBe(false)
  })

  it('ignores an event that carries no code', () => {
    handleKeyboardEvent({ eventName: 'keydown', key: 'w' })
    expect(getKeyboardState().forward).toBe(false)
  })

  it('maps the movement keys and their arrow aliases onto the same directions', () => {
    handleKeyboardEvent({ eventName: 'keydown', code: 'ArrowUp' })
    handleKeyboardEvent({ eventName: 'keydown', code: 'KeyD' })
    handleKeyboardEvent({ eventName: 'keydown', code: 'Space' })
    handleKeyboardEvent({ eventName: 'keydown', code: 'ShiftRight' })

    expect(getKeyboardState()).toEqual({
      forward: true,
      backward: false,
      left: false,
      right: true,
      jump: true,
      shift: true,
    })
  })

  it('clears every pressed key on blur — the window lost focus and no keyup will arrive', () => {
    handleKeyboardEvent({ eventName: 'keydown', code: 'KeyW' })
    handleKeyboardEvent({ eventName: 'keydown', code: 'ShiftLeft' })

    handleKeyboardEvent({ eventName: 'blur' })

    expect(getKeyboardState()).toEqual({
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      shift: false,
    })
  })
})

describe('subscribers', () => {
  it('is notified once per state change and not at all on auto-repeat', () => {
    const handler = vi.fn()
    const unsubscribe = onKeyboardEvent(handler)

    handleKeyboardEvent({ eventName: 'keydown', key: 'w', code: 'KeyW' })
    handleKeyboardEvent({ eventName: 'keydown', key: 'w', code: 'KeyW', repeat: true })
    handleKeyboardEvent({ eventName: 'keydown', key: 'w', code: 'KeyW' })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ key: 'w', code: 'KeyW', pressed: true })

    handleKeyboardEvent({ eventName: 'keyup', key: 'w', code: 'KeyW' })
    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenLastCalledWith({ key: 'w', code: 'KeyW', pressed: false })

    unsubscribe()
  })

  it('stops delivering after the returned unsubscribe is called', () => {
    const handler = vi.fn()
    const unsubscribe = onKeyboardEvent(handler)
    unsubscribe()

    handleKeyboardEvent({ eventName: 'keydown', code: 'KeyA' })

    expect(handler).not.toHaveBeenCalled()
  })
})
