import React, { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, Center, ContactShadows, Environment, CameraControls } from '@react-three/drei'

function Model() {
  const mesh = useRef()
  const { nodes, materials } = useGLTF('/pmndrs.glb')
  const [hovered, setHover] = useState(false)
  const [active, setActive] = useState(false)
  const color = hovered ? 'hotpink' : 'orange'
  useFrame((state, delta) => {
    mesh.current.rotation.x += delta / 2
    mesh.current.rotation.y += delta / 2
  })
  return (
    <>
      <Center ref={mesh}>
        <mesh
          castShadow
          geometry={nodes.cube.geometry}
          material={materials.base}
          material-color={color}
          scale={active ? 0.3 : 0.25}
          onClick={(e) => (e.stopPropagation(), setActive(!active))}
          onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
          onPointerOut={(e) => setHover(false)}
        />
      </Center>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <shadowMaterial transparent opacity={0.4} side="double" />
      </mesh>
    </>
  )
}

export default function App() {
  return (
    <>
      <ambientLight />
      <directionalLight
        castShadow
        position={[5, 5, 5]}
        shadow-mapSize={[2048, 2048]}
        shadow-radius={8}
        shadow-blurSamples={16}
      />
      <Model />
      <Environment preset="city" />
      <CameraControls minPolarAngle={Math.PI / 2} maxPolarAngle={Math.PI / 2} />
    </>
  )
}
