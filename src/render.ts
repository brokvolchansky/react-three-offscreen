/// <reference lib="webworker" />

import mitt from 'mitt'
import { extend, createRoot, ReconcilerRoot, Dpr, Size } from '@react-three/fiber'
import { DomEvent } from '@react-three/fiber/dist/declarations/src/core/events'
import { createPointerEvents } from './events'
import { handleKeyboardEvent } from './keyboard'
import { handlePointerLockEvent, handleMouseMovement } from './pointerlock'
import type { RendererType } from './gl/types'


// Worker global scope with shims for three.js
interface WorkerGlobalScopeWithShims extends DedicatedWorkerGlobalScope {
  window: unknown
  document: unknown
  Image: unknown
}

declare const self: WorkerGlobalScopeWithShims

// eslint-disable-next-line @typescript-eslint/no-explicit-any



export function render(children: React.ReactNode, renderer: RendererType = 'webgl') {
  let root: ReconcilerRoot<HTMLCanvasElement>
  let dpr: Dpr = [1, 2]
  let size: Size = { width: 0, height: 0, top: 0, left: 0 }
  const emitter = mitt()

  const handleInit = async (payload: any) => {
    const {
      props: rawProps,
      drawingSurface: canvas,
      width: rawWidth,
      top,
      left,
      height: rawHeight,
      pixelRatio,
    } = payload
    const { onCreated: userOnCreated, ...props } = rawProps || {}

    // WebGPU requires integer dimensions, ensure they're at least 1
    const width = Math.max(1, Math.floor(rawWidth))
    const height = Math.max(1, Math.floor(rawHeight))

    try {
      // Unmount root if already mounted
      if (root) {
        root.unmount()
      }

      // Shim the canvas into a fake window/document
      Object.assign(canvas, {
        pageXOffset: left,
        pageYOffset: top,
        clientLeft: left,
        clientTop: top,
        clientWidth: width,
        clientHeight: height,
        style: { touchAction: 'none' },
        ownerDocument: canvas,
        documentElement: canvas,
        getBoundingClientRect() {
          return size
        },
        setAttribute() {},
        setPointerCapture() {},
        releasePointerCapture() {},
        addEventListener(event: string, callback: () => void) {
          emitter.on(event, callback)
        },
        removeEventListener(event: string, callback: () => void) {
          emitter.off(event, callback)
        },
      })
      // Set canvas dimensions before creating WebGPU context
      canvas.width = width * Math.min(Math.max(1, pixelRatio), 2)
      canvas.height = height * Math.min(Math.max(1, pixelRatio), 2)

      // Configure root (await for async gl factory support, e.g. WebGPU)
      const { createRenderer, THREE } = renderer === 'webgpu' ? await import('./gl/webgpu') : await import('./gl/webgl')

      // Create react-three-fiber root
      root = createRoot(canvas)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extend(THREE as any)

      // Shim ImageLoader for worker environment
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      THREE.ImageLoader.prototype.load = function (
        url: string,
        onLoad: (img: ImageBitmap) => void,
        onProgress: () => void,
        onError: (e: Error) => void
      ) {
        if (this.path !== undefined) url = this.path + url
        url = this.manager.resolveURL(url)
        const scope = this
        const cached = THREE.Cache.get(url)

        if (cached !== undefined) {
          scope.manager.itemStart(url)
          if (onLoad) onLoad(cached)
          scope.manager.itemEnd(url)
          return cached
        }

        fetch(url)
          .then((res) => res.blob())
          .then((res) => createImageBitmap(res, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }))
          .then((bitmap) => {
            THREE.Cache.add(url, bitmap)
            if (onLoad) onLoad(bitmap)
            scope.manager.itemEnd(url)
          })
          .catch(onError)
        return {}
      }

      await root.configure({
        ...(renderer === 'webgpu' ? { gl: () => createRenderer(canvas, props.gl) } : {}),
        events: createPointerEvents(emitter),
        size: (size = { width, height, top, left }),
        dpr: (dpr = Math.min(Math.max(1, pixelRatio), 2)),
        ...props,
        onCreated: (state) => {
          // console.log('render.ts: renderer =', state.gl.constructor.name)

          if (props.eventPrefix) {
            state.setEvents({
              compute: (event, state) => {
                const x = event[(props.eventPrefix + 'X') as keyof DomEvent] as number
                const y = event[(props.eventPrefix + 'Y') as keyof DomEvent] as number
                state.pointer.set((x / state.size.width) * 2 - 1, -(y / state.size.height) * 2 + 1)
                state.raycaster.setFromCamera(state.pointer, state.camera)
              },
            })
          }

          userOnCreated?.(state)
        },
      })

      // Render children once
      await root.render(children)
    } catch (e: any) {
      postMessage({ type: 'error', payload: e?.message })
    }

    // Shim window to the canvas from here on
    self.window = canvas
  }

  const handleResize = ({ width, height, top, left }: Size) => {
    if (!root) return
    root.configure({ size: (size = { width, height, top, left }), dpr })
  }

  const handleEvents = (payload: any) => {
    const { eventName } = payload

    // Keyboard events
    if (eventName === 'keydown' || eventName === 'keyup' || eventName === 'blur') {
      handleKeyboardEvent(payload)
      return
    }

    // Pointer lock events
    if (eventName === 'pointerlockchange' || eventName === 'pointerlockerror') {
      handlePointerLockEvent(payload)
      return
    }

    // Accumulate mouse movement for pointer lock
    if (eventName === 'pointermove' && payload.movementX !== undefined) {
      handleMouseMovement(payload.movementX, payload.movementY)
    }

    // Emit to r3f event system
    emitter.emit(eventName, { ...payload, preventDefault() {}, stopPropagation() {} })
  }

  const handleProps = (payload: any) => {
    // For WebGPU, we cannot reconfigure after init because r3f will try to create WebGLRenderer
    // All props must be passed during init. Only dpr updates are safe.
    if (!root) return
    if (payload.dpr) {
      dpr = payload.dpr
      root.configure({ size, dpr })
    }
  }

  const handlerMap = {
    resize: handleResize,
    init: handleInit,
    dom_events: handleEvents,
    props: handleProps,
  }

  self.onmessage = (event) => {
    const { type, payload } = event.data
    const handler = handlerMap[type as keyof typeof handlerMap]
    if (handler) handler(payload)
  }

  // Shims for web offscreen canvas
  // @ts-ignore
  self.window = {}
  // @ts-ignore
  self.document = {}
  // @ts-ignore
  self.Image = class {
    height = 1
    width = 1
    set onload(callback: any) {
      callback(true)
    }
  }
}
