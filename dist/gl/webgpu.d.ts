import * as THREE from 'three/webgpu';
import { ThreeToJSXElements } from '@react-three/fiber';
declare global {
    type GPU = any;
    interface Navigator {
        gpu?: GPU;
    }
}
declare module "@react-three/fiber" {
    interface ThreeElements extends ThreeToJSXElements<typeof THREE> {
    }
}
type WebGPURendererParameters = ConstructorParameters<typeof THREE.WebGPURenderer>[0];
export declare const createRenderer: (canvas: OffscreenCanvas, props?: Partial<WebGPURendererParameters>) => Promise<THREE.WebGPURenderer>;
export { THREE };
