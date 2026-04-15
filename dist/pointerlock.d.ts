/**
 * Pointer lock state manager for worker context
 */
type PointerLockHandler = (locked: boolean) => void;
/**
 * Handle pointer lock events from main thread
 * @internal
 */
export declare function handlePointerLockEvent(payload: {
    eventName: 'pointerlockchange' | 'pointerlockerror';
    locked?: boolean;
}): void;
/**
 * Handle mouse movement (called from pointermove)
 * @internal
 */
export declare function handleMouseMovement(movementX: number, movementY: number): void;
/**
 * Check if pointer is currently locked
 */
export declare function isPointerLocked(): boolean;
/**
 * Consume accumulated mouse delta since last call
 */
export declare function consumeMouseDelta(): {
    x: number;
    y: number;
};
/**
 * Subscribe to pointer lock state changes
 * @returns Unsubscribe function
 */
export declare function onPointerLockChange(handler: PointerLockHandler): () => void;
export {};
