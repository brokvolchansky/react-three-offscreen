import React from 'react'
import { render } from '@react-three/offscreen'
import Scene from './Scene'

render(<Scene />, 'webgpu') // 'webgl'|'webgpu', 'webgl' is default
