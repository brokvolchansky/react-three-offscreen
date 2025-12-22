/**
 * Keyboard state manager for worker context
 */

const keyboardState = new Map<string, boolean>()

type KeyboardEventHandler = (event: { key: string; code: string; pressed: boolean }) => void
const listeners = new Set<KeyboardEventHandler>()

/**
 * Handle keyboard event from main thread
 * @internal
 */
export function handleKeyboardEvent(payload: {
  eventName: 'keydown' | 'keyup' | 'blur'
  key?: string
  code?: string
  repeat?: boolean
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}): void {
  if (payload.eventName === 'blur') {
    keyboardState.clear()
    return
  }

  if (!payload.code) return

  const pressed = payload.eventName === 'keydown'

  // Skip repeat events for keydown
  if (pressed && payload.repeat) return

  const current = keyboardState.get(payload.code) ?? false
  if (current !== pressed) {
    keyboardState.set(payload.code, pressed)

    listeners.forEach((handler) => {
      handler({
        key: payload.key ?? '',
        code: payload.code!,
        pressed,
      })
    })
  }
}

/**
 * Check if a specific key is currently pressed
 * @param code - KeyboardEvent.code (e.g., 'KeyW', 'Space', 'ShiftLeft')
 */
export function isKeyPressed(code: string): boolean {
  return keyboardState.get(code) ?? false
}

/**
 * Get keyboard state for common game controls
 */
export function getKeyboardState(): {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  jump: boolean
  shift: boolean
} {
  return {
    forward: isKeyPressed('KeyW') || isKeyPressed('ArrowUp'),
    backward: isKeyPressed('KeyS') || isKeyPressed('ArrowDown'),
    left: isKeyPressed('KeyA') || isKeyPressed('ArrowLeft'),
    right: isKeyPressed('KeyD') || isKeyPressed('ArrowRight'),
    jump: isKeyPressed('Space'),
    shift: isKeyPressed('ShiftLeft') || isKeyPressed('ShiftRight'),
  }
}

/**
 * Subscribe to keyboard events
 * @returns Unsubscribe function
 */
export function onKeyboardEvent(handler: KeyboardEventHandler): () => void {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

/**
 * React hook for keyboard state (use in useFrame)
 */
export function useKeyboard() {
  return getKeyboardState
}