import * as THREE from 'three';
import type { WebGLRendererParameters } from 'three';
import { ThreeToJSXElements } from '@react-three/fiber';
declare module "@react-three/fiber" {
    interface ThreeElements extends ThreeToJSXElements<typeof THREE> {
    }
}
export declare const createRenderer: (canvas: OffscreenCanvas, props?: WebGLRendererParameters) => THREE.WebGLRenderer;
export { THREE };
