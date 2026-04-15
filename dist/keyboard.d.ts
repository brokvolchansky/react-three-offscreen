/**
 * Keyboard state manager for worker context
 */
type KeyboardEventHandler = (event: {
    key: string;
    code: string;
    pressed: boolean;
}) => void;
/**
 * Handle keyboard event from main thread
 * @internal
 */
export declare function handleKeyboardEvent(payload: {
    eventName: 'keydown' | 'keyup' | 'blur';
    key?: string;
    code?: string;
    repeat?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
}): void;
/**
 * Check if a specific key is currently pressed
 * @param code - KeyboardEvent.code (e.g., 'KeyW', 'Space', 'ShiftLeft')
 */
export declare function isKeyPressed(code: string): boolean;
/**
 * Get keyboard state for common game controls
 */
export declare function getKeyboardState(): {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    jump: boolean;
    shift: boolean;
};
/**
 * Subscribe to keyboard events
 * @returns Unsubscribe function
 */
export declare function onKeyboardEvent(handler: KeyboardEventHandler): () => void;
/**
 * React hook for keyboard state (use in useFrame)
 */
export declare function useKeyboard(): typeof getKeyboardState;
export {};
