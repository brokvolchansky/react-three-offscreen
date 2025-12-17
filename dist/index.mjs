import _extends from '@babel/runtime/helpers/esm/extends';
import React, { useRef, useEffect } from 'react';
import { createEvents, Canvas as Canvas$1, createRoot, extend } from '@react-three/fiber';
import mitt from 'mitt';

const EVENTS = {
  onClick: ['click', false],
  onContextMenu: ['contextmenu', false],
  onDoubleClick: ['dblclick', false],
  onWheel: ['wheel', true],
  onPointerDown: ['pointerdown', true],
  onPointerUp: ['pointerup', true],
  onPointerLeave: ['pointerleave', true],
  onPointerMove: ['pointermove', true],
  onPointerCancel: ['pointercancel', true],
  onLostPointerCapture: ['lostpointercapture', true]
};
function createPointerEvents(emitter) {
  return store => {
    const {
      handlePointer
    } = createEvents(store);
    return {
      priority: 1,
      enabled: true,
      compute(event, state) {
        // https://github.com/pmndrs/react-three-fiber/pull/782
        // Events trigger outside of canvas when moved, use offsetX/Y by default and allow overrides
        state.pointer.set(event.offsetX / state.size.width * 2 - 1, -(event.offsetY / state.size.height) * 2 + 1);
        state.raycaster.setFromCamera(state.pointer, state.camera);
      },
      connected: undefined,
      handlers: Object.keys(EVENTS).reduce((acc, key) => ({
        ...acc,
        [key]: handlePointer(key)
      }), {}),
      connect: target => {
        const {
          set,
          events
        } = store.getState();
        events.disconnect?.();
        set(state => ({
          events: {
            ...state.events,
            connected: target
          }
        }));
        Object.entries(events?.handlers ?? []).forEach(([name, event]) => {
          const [eventName] = EVENTS[name];
          emitter.on(eventName, event);
        });
      },
      disconnect: () => {
        const {
          set,
          events
        } = store.getState();
        if (events.connected) {
          Object.entries(events.handlers ?? []).forEach(([name, event]) => {
            const [eventName] = EVENTS[name];
            emitter.off(eventName, event);
          });
          set(state => ({
            events: {
              ...state.events,
              connected: undefined
            }
          }));
        }
      }
    };
  };
}

function isRefObject(ref) {
  return ref && ref.current !== undefined;
}
function Canvas({
  eventSource,
  worker,
  fallback,
  style,
  className,
  id,
  ...props
}) {
  const [shouldFallback, setFallback] = React.useState(false);
  const canvasRef = useRef(null);
  const hasTransferredToOffscreen = useRef(false);
  useEffect(() => {
    if (!worker) return;
    const canvas = canvasRef.current;
    try {
      if (!hasTransferredToOffscreen.current) {
        const offscreen = canvasRef.current.transferControlToOffscreen();
        hasTransferredToOffscreen.current = true;
        worker.postMessage({
          type: 'init',
          payload: {
            props,
            drawingSurface: offscreen,
            width: canvas.clientWidth,
            height: canvas.clientHeight,
            top: canvas.offsetTop,
            left: canvas.offsetLeft,
            pixelRatio: window.devicePixelRatio
          }
        }, [offscreen]);
      }
    } catch (e) {
      // Browser doesn't support offscreen canvas at all
      setFallback(true);
      return;
    }
    worker.onmessage = e => {
      if (e.data.type === 'error') {
        // Worker failed to initialize
        setFallback(true);
      }
    };
    const currentEventSource = isRefObject(eventSource) ? eventSource.current : eventSource || canvas;
    Object.values(EVENTS).forEach(([eventName, passive]) => {
      currentEventSource.addEventListener(eventName, event => {
        // Prevent default for all passive events
        if (!passive) event.preventDefault();
        // Capture pointer automatically on pointer down
        if (eventName === 'pointerdown') {
          event.target.setPointerCapture(event.pointerId);
        } else if (eventName === 'pointerup') {
          event.target.releasePointerCapture(event.pointerId);
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
            y: event.y
          }
        });
      }, {
        passive
      });
    });
    const handleResize = () => {
      worker.postMessage({
        type: 'resize',
        payload: {
          width: currentEventSource.clientWidth,
          height: currentEventSource.clientHeight,
          top: currentEventSource.offsetTop,
          left: currentEventSource.offsetLeft
        }
      });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [worker]);
  useEffect(() => {
    if (!worker) return;
    worker.postMessage({
      type: 'props',
      payload: props
    });
  }, [worker, props]);
  return shouldFallback ? /*#__PURE__*/React.createElement(Canvas$1, _extends({
    id: id,
    className: className,
    style: style
  }, props), fallback) : /*#__PURE__*/React.createElement("canvas", {
    id: id,
    className: className,
    style: {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      display: 'block',
      ...style
    },
    ref: canvasRef
  });
}

/// <reference lib="webworker" />


// Worker global scope with shims for three.js

// eslint-disable-next-line @typescript-eslint/no-explicit-any

function render(children, renderer = 'webgl') {
  let root;
  let dpr = [1, 2];
  let size = {
    width: 0,
    height: 0,
    top: 0,
    left: 0
  };
  const emitter = mitt();
  const handleInit = async payload => {
    const {
      props: rawProps,
      drawingSurface: canvas,
      width: rawWidth,
      top,
      left,
      height: rawHeight,
      pixelRatio
    } = payload;
    const {
      onCreated: userOnCreated,
      ...props
    } = rawProps || {};

    // WebGPU requires integer dimensions, ensure they're at least 1
    const width = Math.max(1, Math.floor(rawWidth));
    const height = Math.max(1, Math.floor(rawHeight));
    try {
      // Unmount root if already mounted
      if (root) {
        root.unmount();
      }

      // Shim the canvas into a fake window/document
      Object.assign(canvas, {
        pageXOffset: left,
        pageYOffset: top,
        clientLeft: left,
        clientTop: top,
        clientWidth: width,
        clientHeight: height,
        style: {
          touchAction: 'none'
        },
        ownerDocument: canvas,
        documentElement: canvas,
        getBoundingClientRect() {
          return size;
        },
        setAttribute() {},
        setPointerCapture() {},
        releasePointerCapture() {},
        addEventListener(event, callback) {
          emitter.on(event, callback);
        },
        removeEventListener(event, callback) {
          emitter.off(event, callback);
        }
      });
      // Set canvas dimensions before creating WebGPU context
      canvas.width = width * Math.min(Math.max(1, pixelRatio), 2);
      canvas.height = height * Math.min(Math.max(1, pixelRatio), 2);

      // Configure root (await for async gl factory support, e.g. WebGPU)
      const {
        createRenderer,
        THREE
      } = renderer === 'webgpu' ? await import('./webgpu.mjs') : await import('./webgl.mjs');

      // Create react-three-fiber root
      root = createRoot(canvas);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extend(THREE);

      // Shim ImageLoader for worker environment
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      THREE.ImageLoader.prototype.load = function (url, onLoad, onProgress, onError) {
        if (this.path !== undefined) url = this.path + url;
        url = this.manager.resolveURL(url);
        const scope = this;
        const cached = THREE.Cache.get(url);
        if (cached !== undefined) {
          scope.manager.itemStart(url);
          if (onLoad) onLoad(cached);
          scope.manager.itemEnd(url);
          return cached;
        }
        fetch(url).then(res => res.blob()).then(res => createImageBitmap(res, {
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none'
        })).then(bitmap => {
          THREE.Cache.add(url, bitmap);
          if (onLoad) onLoad(bitmap);
          scope.manager.itemEnd(url);
        }).catch(onError);
        return {};
      };
      await root.configure({
        ...(renderer === 'webgpu' ? {
          gl: () => createRenderer(canvas, props.gl)
        } : {}),
        events: createPointerEvents(emitter),
        size: size = {
          width,
          height,
          top,
          left
        },
        dpr: dpr = Math.min(Math.max(1, pixelRatio), 2),
        ...props,
        onCreated: state => {
          // console.log('render.ts: renderer =', state.gl.constructor.name)

          if (props.eventPrefix) {
            state.setEvents({
              compute: (event, state) => {
                const x = event[props.eventPrefix + 'X'];
                const y = event[props.eventPrefix + 'Y'];
                state.pointer.set(x / state.size.width * 2 - 1, -(y / state.size.height) * 2 + 1);
                state.raycaster.setFromCamera(state.pointer, state.camera);
              }
            });
          }
          userOnCreated?.(state);
        }
      });

      // Render children once
      await root.render(children);
    } catch (e) {
      postMessage({
        type: 'error',
        payload: e?.message
      });
    }

    // Shim window to the canvas from here on
    self.window = canvas;
  };
  const handleResize = ({
    width,
    height,
    top,
    left
  }) => {
    if (!root) return;
    root.configure({
      size: size = {
        width,
        height,
        top,
        left
      },
      dpr
    });
  };
  const handleEvents = payload => {
    emitter.emit(payload.eventName, {
      ...payload,
      preventDefault() {},
      stopPropagation() {}
    });
  };
  const handleProps = payload => {
    // For WebGPU, we cannot reconfigure after init because r3f will try to create WebGLRenderer
    // All props must be passed during init. Only dpr updates are safe.
    if (!root) return;
    if (payload.dpr) {
      dpr = payload.dpr;
      root.configure({
        size,
        dpr
      });
    }
  };
  const handlerMap = {
    resize: handleResize,
    init: handleInit,
    dom_events: handleEvents,
    props: handleProps
  };
  self.onmessage = event => {
    const {
      type,
      payload
    } = event.data;
    const handler = handlerMap[type];
    if (handler) handler(payload);
  };

  // Shims for web offscreen canvas
  // @ts-ignore
  self.window = {};
  // @ts-ignore
  self.document = {};
  // @ts-ignore
  self.Image = class {
    height = 1;
    width = 1;
    set onload(callback) {
      callback(true);
    }
  };
}

export { Canvas, render };
