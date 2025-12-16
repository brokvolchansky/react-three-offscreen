import path from 'path'
import babel from '@rollup/plugin-babel'
import resolve from '@rollup/plugin-node-resolve'

const root = process.platform === 'win32' ? path.resolve('/') : '/'
const external = (id) => !id.startsWith('.') && !id.startsWith(root)
const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json']

const getBabelOptions = ({ useESModules }) => ({
  babelrc: false,
  extensions,
  exclude: '**/node_modules/**',
  babelHelpers: 'runtime',
  presets: [
    [
      '@babel/preset-env',
      {
        bugfixes: true,
        loose: true,
        modules: false,
        targets: '> 1%, not dead, not ie 11, not op_mini all',
      },
    ],
    '@babel/preset-react',
    '@babel/preset-typescript',
  ],
  plugins: [['@babel/transform-runtime', { regenerator: false, useESModules }]],
})

export default [
  {
    input: `./src/index.tsx`,
    output: { dir: `dist`, format: 'esm', entryFileNames: 'index.mjs', chunkFileNames: '[name].mjs' },
    external,
    plugins: [babel(getBabelOptions({ useESModules: true })), resolve({ extensions })],
  },
  {
    input: `./src/index.tsx`,
    output: { dir: `dist/cjs`, format: 'cjs', entryFileNames: 'index.js', chunkFileNames: '[name].js' },
    external,
    plugins: [babel(getBabelOptions({ useESModules: false })), resolve({ extensions })],
  },
]
