import * as THREE from 'three/webgpu'
import { ThreeToJSXElements } from '@react-three/fiber'

declare module "@react-three/fiber" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

type WebGPURendererParameters = ConstructorParameters<typeof THREE.WebGPURenderer>[0]

export const createRenderer = async (canvas: OffscreenCanvas, props?: Partial<WebGPURendererParameters>) => {
  if (!navigator.gpu) {
    throw new Error('WebGPU not supported')
  }
  const renderer = new THREE.WebGPURenderer({ ...props, canvas })
  await renderer.init()
  return renderer
}

export { THREE }