import React, { useEffect, useRef } from 'react'
import type { Options as ResizeOptions } from 'react-use-measure'
import { Canvas as CanvasImpl, RenderProps } from '@react-three/fiber'
import { EVENTS } from './events'

export interface CanvasProps
  extends Omit<RenderProps<HTMLCanvasElement>, 'size'>,
    React.HTMLAttributes<HTMLDivElement> {
  worker: Worker
  fallback?: React.ReactNode
  /**
   * Options to pass to useMeasure.
   * @see https://github.com/pmndrs/react-use-measure#api
   */
  resize?: ResizeOptions
  /** The target where events are being subscribed to, default: the div that wraps canvas */
  eventSource?: HTMLElement | React.MutableRefObject<HTMLElement>
  /** The event prefix that is cast into canvas pointer x/y events, default: "offset" */
  eventPrefix?: 'offset' | 'client' | 'page' | 'layer' | 'screen'
  /** Enable pointer lock on canvas click (for FPS-style controls) */
  pointerLock?: boolean
}

function isRefObject<T>(ref: any): ref is React.MutableRefObject<T> {
  return ref && ref.current !== undefined
}

export function Canvas({ eventSource, worker, fallback, style, className, id, pointerLock, ...props }: CanvasProps) {
  const [shouldFallback, setFallback] = React.useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null!)
  const hasTransferredToOffscreen = useRef(false)

  useEffect(() => {
    if (!worker) return

    const canvas = canvasRef.current
    try {
      if (!hasTransferredToOffscreen.current) {
        const offscreen = canvasRef.current.transferControlToOffscreen()
        hasTransferredToOffscreen.current = true
        worker.postMessage(
          {
            type: 'init',
            payload: {
              props,
              drawingSurface: offscreen,
              width: canvas.clientWidth,
              height: canvas.clientHeight,
              top: canvas.offsetTop,
              left: canvas.offsetLeft,
              pixelRatio: window.devicePixelRatio,
            },
          },
          [offscreen]
        )
      }
    } catch (e) {
      // Browser doesn't support offscreen canvas at all
      setFallback(true)
      return
    }

    worker.onmessage = (e) => {
      if (e.data.type === 'error') {
        // Worker failed to initialize
        setFallback(true)
      }
    }

    const currentEventSource = isRefObject(eventSource) ? eventSource.current : eventSource || canvas

    // Store handlers for cleanup — inline arrow functions can't be removed by removeEventListener
    const eventHandlers: Array<[string, EventListener]> = []

    Object.values(EVENTS).forEach(([eventName, passive]) => {
      const handler = (event: any) => {
        // Prevent default for all non-passive events
        if (!passive) event.preventDefault()
        // Capture pointer automatically on pointer down
        if (eventName === 'pointerdown') {
          try {
            event.target.setPointerCapture(event.pointerId)
          } catch {
            // Silently ignore — can fail during fullscreen transitions,
            // pointer lock state changes, or DOM restructuring.
            // Pointer capture is non-critical for scene interaction.
          }
        } else if (eventName === 'pointerup') {
          try {
            event.target.releasePointerCapture(event.pointerId)
          } catch {
            // Same as above
          }
        }

        worker.postMessage({
          type: 'dom_events',
          payload: {
            eventName,
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            button: event.button,
            buttons: event.buttons,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey,
            movementX: event.movementX,
            movementY: event.movementY,
            clientX: event.clientX,
            clientY: event.clientY,
            offsetX: event.offsetX,
            offsetY: event.offsetY,
            pageX: event.pageX,
            pageY: event.pageY,
            x: event.x,
            y: event.y,
          },
        })
      }
      currentEventSource.addEventListener(eventName, handler, { passive })
      eventHandlers.push([eventName, handler])
    })

    // ResizeObserver replaces window.resize — covers ALL container resize cases:
    // fullscreen transitions, sidebar toggles, panel resizes, AND window resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries.length) return
      // Use clientWidth/clientHeight from currentEventSource (same as existing handleResize logic)
      const width = currentEventSource.clientWidth
      const height = currentEventSource.clientHeight
      if (width > 0 && height > 0) {
        worker.postMessage({
          type: 'resize',
          payload: {
            width,
            height,
            top: currentEventSource.offsetTop,
            left: currentEventSource.offsetLeft,
          },
        })
      }
    })
    resizeObserver.observe(currentEventSource)

    // Keyboard events (attached to window)
    const handleKeyDown = (event: KeyboardEvent) => {
      worker.postMessage({
        type: 'dom_events',
        payload: {
          eventName: 'keydown',
          key: event.key,
          code: event.code,
          repeat: event.repeat,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
        },
      })
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      worker.postMessage({
        type: 'dom_events',
        payload: {
          eventName: 'keyup',
          key: event.key,
          code: event.code,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
        },
      })
    }
    const handleBlur = () => {
      worker.postMessage({
        type: 'dom_events',
        payload: { eventName: 'blur' },
      })
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    // Pointer lock events (attached to document)
    const handlePointerLockChange = () => {
      worker.postMessage({
        type: 'dom_events',
        payload: {
          eventName: 'pointerlockchange',
          locked: document.pointerLockElement === canvas,
        },
      })
    }
    const handlePointerLockError = () => {
      worker.postMessage({
        type: 'dom_events',
        payload: { eventName: 'pointerlockerror' },
      })
    }
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    document.addEventListener('pointerlockerror', handlePointerLockError)

    // Request pointer lock on click (if enabled)
    const handlePointerLockClick = () => canvas.requestPointerLock()
    if (pointerLock) {
      canvas.addEventListener('click', handlePointerLockClick)
    }

    return () => {
      // Clean up EVENTS listeners (pointer, click, wheel, etc.)
      eventHandlers.forEach(([eventName, handler]) => {
        currentEventSource.removeEventListener(eventName, handler)
      })
      // Clean up ResizeObserver (replaces window.resize)
      resizeObserver.disconnect()
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
      document.removeEventListener('pointerlockerror', handlePointerLockError)
      if (pointerLock) {
        canvas.removeEventListener('click', handlePointerLockClick)
      }
    }
  }, [worker, pointerLock])

  return shouldFallback ? (
    <CanvasImpl id={id} className={className} style={style} {...props}>
      {fallback}
    </CanvasImpl>
  ) : (
    <canvas
      id={id}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', display: 'block', ...style }}
      ref={canvasRef}
    />
  )
}
