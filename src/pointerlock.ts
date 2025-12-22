/**
 * Pointer lock state manager for worker context
 */

let pointerLocked = false
let accumulatedMovementX = 0
let accumulatedMovementY = 0

type PointerLockHandler = (locked: boolean) => void
const listeners = new Set<PointerLockHandler>()

/**
 * Handle pointer lock events from main thread
 * @internal
 */
export function handlePointerLockEvent(payload: {
  eventName: 'pointerlockchange' | 'pointerlockerror'
  locked?: boolean
}): void {
  if (payload.eventName === 'pointerlockchange') {
    const wasLocked = pointerLocked
    pointerLocked = payload.locked ?? false

    if (!pointerLocked) {
      accumulatedMovementX = 0
      accumulatedMovementY = 0
    }

    if (wasLocked !== pointerLocked) {
      listeners.forEach((handler) => handler(pointerLocked))
    }
  }
}

/**
 * Handle mouse movement (called from pointermove)
 * @internal
 */
export function handleMouseMovement(movementX: number, movementY: number): void {
  if (pointerLocked) {
    accumulatedMovementX += movementX
    accumulatedMovementY += movementY
  }
}

/**
 * Check if pointer is currently locked
 */
export function isPointerLocked(): boolean {
  return pointerLocked
}

/**
 * Consume accumulated mouse delta since last call
 */
export function consumeMouseDelta(): { x: number; y: number } {
  const delta = {
    x: accumulatedMovementX,
    y: accumulatedMovementY,
  }
  accumulatedMovementX = 0
  accumulatedMovementY = 0
  return delta
}

/**
 * Subscribe to pointer lock state changes
 * @returns Unsubscribe function
 */
export function onPointerLockChange(handler: PointerLockHandler): () => void {
  listeners.add(handler)
  return () => listeners.delete(handler)
}