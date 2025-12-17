import * as THREE from 'three';
export { THREE };

const createRenderer = (canvas, props) => {
  return new THREE.WebGLRenderer({
    ...props,
    canvas
  });
};

export { createRenderer };
