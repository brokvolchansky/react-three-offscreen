import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  consumeMouseDelta,
  handleMouseMovement,
  handlePointerLockEvent,
  isPointerLocked,
  onPointerLockChange,
} from './pointerlock'

/**
 * The pointer lock manager accumulates mouse movement inside the worker between frames. The render
 * loop reads the delta once per frame and expects it to be consumed: a delta that is not reset, or
 * one that keeps growing while the pointer is unlocked, makes the camera drift on its own.
 */

/** The state lives in module scope, so every case starts from the unlocked, drained state. */
beforeEach(() => {
  handlePointerLockEvent({ eventName: 'pointerlockchange', locked: false })
  consumeMouseDelta()
})

describe('lock state', () => {
  it('follows pointerlockchange', () => {
    handlePointerLockEvent({ eventName: 'pointerlockchange', locked: true })
    expect(isPointerLocked()).toBe(true)

    handlePointerLockEvent({ eventName: 'pointerlockchange', locked: false })
    expect(isPointerLocked()).toBe(false)
  })

  it('notifies subscribers only on a real transition and stops after unsubscribe', () => {
    const handler = vi.fn()
    const unsubscribe = onPointerLockChange(handler)

    handlePointerLockEvent({ eventName: 'pointerlockchange', locked: true })
    handlePointerLockEvent({ eventName: 'pointerlockchange', locked: true })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(true)

    unsubscribe()
    handlePointerLockEvent({ eventName: 'pointerlockchange', locked: false })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('leaves the state alone on pointerlockerror', () => {
    handlePointerLockEvent({ eventName: 'pointerlockchange', locked: true })
    handlePointerLockEvent({ eventName: 'pointerlockerror' })
    expect(isPointerLocked()).toBe(true)
  })
})

describe('mouse delta', () => {
  it('accumulates while locked and is drained by the read', () => {
    handlePointerLockEvent({ eventName: 'pointerlockchange', locked: true })

    handleMouseMovement(3, -2)
    handleMouseMovement(1, 5)

    expect(consumeMouseDelta()).toEqual({ x: 4, y: 3 })
    expect(consumeMouseDelta()).toEqual({ x: 0, y: 0 })
  })

  it('ignores movement while the pointer is not locked', () => {
    handleMouseMovement(10, 10)
    expect(consumeMouseDelta()).toEqual({ x: 0, y: 0 })
  })

  it('drops the pending delta when the lock is released', () => {
    handlePointerLockEvent({ eventName: 'pointerlockchange', locked: true })
    handleMouseMovement(7, 7)

    handlePointerLockEvent({ eventName: 'pointerlockchange', locked: false })

    expect(consumeMouseDelta()).toEqual({ x: 0, y: 0 })
  })
})
