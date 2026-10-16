import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { render } from './render'

/**
 * render() is the worker half of the offscreen canvas: it builds the react-three-fiber root on the
 * `init` message and reconfigures it on later `resize` and `props` messages. react-three-fiber's
 * root.configure() applies the WHOLE configuration on every call and resets every omitted prop to
 * its default (shadows → false, shadow map type → PCFSoftShadowMap), so every later configure call
 * must carry the configuration received with `init` again — otherwise the scene loses its shadows
 * on the first resize.
 */

const fiber = vi.hoisted(() => ({
  createRoot: vi.fn(),
  extend: vi.fn(),
  createEvents: vi.fn(),
}))

vi.mock('@react-three/fiber', () => fiber)

vi.mock('./gl/webgpu', () => ({
  createRenderer: vi.fn(),
  THREE: { ImageLoader: class {}, Cache: { get: vi.fn(), add: vi.fn() } },
}))

type FakeRoot = {
  configure: ReturnType<typeof vi.fn>
  render: ReturnType<typeof vi.fn>
  unmount: ReturnType<typeof vi.fn>
}

type WorkerScope = { onmessage: ((event: { data: unknown }) => void) | null }

/** The configuration the main-thread Canvas sends as `props` in the init message (structured-cloneable). */
const initConfiguration = {
  shadows: 'percentage',
  linear: true,
  flat: false,
  frameloop: 'always',
  camera: { position: [0, 2, 5], fov: 50 },
  performance: { min: 0.5 },
  eventPrefix: 'client',
} as const

let root: FakeRoot
let scope: WorkerScope

const send = (type: string, payload: unknown) => scope.onmessage?.({ data: { type, payload } })

const init = async (props: Record<string, unknown> = initConfiguration) => {
  send('init', {
    props,
    drawingSurface: {},
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    pixelRatio: 1,
  })
  await vi.waitFor(() => expect(root.render).toHaveBeenCalledTimes(1))
}

beforeEach(() => {
  root = { configure: vi.fn(), render: vi.fn(), unmount: vi.fn() }
  fiber.createRoot.mockReturnValue(root)
  scope = { onmessage: null }
  vi.stubGlobal('self', scope)
  vi.stubGlobal('postMessage', vi.fn())
  render(null, 'webgpu')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('init', () => {
  it('configures the root once with the received configuration and the worker-side gl factory', async () => {
    await init()

    expect(root.configure).toHaveBeenCalledTimes(1)
    const [config] = root.configure.mock.calls[0]
    expect(config).toMatchObject({ ...initConfiguration, size: { width: 800, height: 600, top: 0, left: 0 }, dpr: 1 })
    expect(config.gl).toBeTypeOf('function')
    expect(config.events).toBeTypeOf('function')
    expect(config.onCreated).toBeTypeOf('function')
  })
})

describe('resize', () => {
  it('re-passes the init configuration together with the new size and the current dpr', async () => {
    await init()

    send('resize', { width: 1024, height: 768, top: 10, left: 20 })

    expect(root.configure).toHaveBeenCalledTimes(2)
    const [config] = root.configure.mock.calls[1]
    expect(config).toEqual({ ...initConfiguration, size: { width: 1024, height: 768, top: 10, left: 20 }, dpr: 1 })
  })

  it('keeps the shadows on every subsequent resize', async () => {
    await init()

    send('resize', { width: 1024, height: 768, top: 0, left: 0 })
    send('resize', { width: 640, height: 480, top: 0, left: 0 })

    expect(root.configure).toHaveBeenCalledTimes(3)
    for (const [config] of root.configure.mock.calls.slice(1)) {
      expect(config.shadows).toBe('percentage')
    }
    expect(root.configure.mock.calls[2][0].size).toEqual({ width: 640, height: 480, top: 0, left: 0 })
  })

  it('does not re-pass gl, events, onCreated or scene, which are created once in the worker', async () => {
    await init({ ...initConfiguration, scene: { background: null } })

    send('resize', { width: 1024, height: 768, top: 0, left: 0 })

    const [config] = root.configure.mock.calls[1]
    expect(config).not.toHaveProperty('gl')
    expect(config).not.toHaveProperty('events')
    expect(config).not.toHaveProperty('onCreated')
    expect(config).not.toHaveProperty('scene')
  })

  it('is ignored before init, as before', () => {
    send('resize', { width: 1024, height: 768, top: 0, left: 0 })

    expect(root.configure).not.toHaveBeenCalled()
  })
})

describe('props', () => {
  it('re-passes the init configuration together with the new dpr and the current size', async () => {
    await init()
    send('resize', { width: 1024, height: 768, top: 0, left: 0 })

    send('props', { dpr: 2 })

    expect(root.configure).toHaveBeenCalledTimes(3)
    const [config] = root.configure.mock.calls[2]
    expect(config).toEqual({ ...initConfiguration, size: { width: 1024, height: 768, top: 0, left: 0 }, dpr: 2 })
  })

  it('keeps the new dpr for the following resize', async () => {
    await init()
    send('props', { dpr: 2 })

    send('resize', { width: 640, height: 480, top: 0, left: 0 })

    const [config] = root.configure.mock.calls[2]
    expect(config).toEqual({ ...initConfiguration, size: { width: 640, height: 480, top: 0, left: 0 }, dpr: 2 })
  })

  it('does not reconfigure when the message carries no dpr', async () => {
    await init()

    send('props', { shadows: false })

    expect(root.configure).toHaveBeenCalledTimes(1)
  })

  it('is ignored before init, as before', () => {
    send('props', { dpr: 2 })

    expect(root.configure).not.toHaveBeenCalled()
  })
})
