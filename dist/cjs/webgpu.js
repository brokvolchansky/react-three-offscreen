'use strict';

var THREE = require('three/webgpu');

function _interopNamespaceDefault(e) {
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var THREE__namespace = /*#__PURE__*/_interopNamespaceDefault(THREE);

const createRenderer = async (canvas, props) => {
  if (!navigator.gpu) {
    throw new Error('WebGPU not supported');
  }
  const renderer = new THREE__namespace.WebGPURenderer({
    ...props,
    canvas
  });
  await renderer.init();
  return renderer;
};

exports.THREE = THREE__namespace;
exports.createRenderer = createRenderer;
