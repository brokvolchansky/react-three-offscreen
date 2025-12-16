import * as THREE from 'three'
import type { WebGLRendererParameters } from 'three'
import { ThreeToJSXElements } from '@react-three/fiber'

declare module "@react-three/fiber" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

export const createRenderer = (canvas: OffscreenCanvas, props?: WebGLRendererParameters) => {
  return new THREE.WebGLRenderer({ ...props, canvas })
}

export { THREE }