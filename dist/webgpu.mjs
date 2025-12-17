import * as THREE from 'three/webgpu';
export { THREE };

const createRenderer = async (canvas, props) => {
  if (!navigator.gpu) {
    throw new Error('WebGPU not supported');
  }
  const renderer = new THREE.WebGPURenderer({
    ...props,
    canvas
  });
  await renderer.init();
  return renderer;
};

export { createRenderer };
