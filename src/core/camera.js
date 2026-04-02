import * as THREE from 'three'
import { scene } from './scene.js'

// playerObject: moves through the world, yaw rotation applied here
export const playerObject = new THREE.Object3D()

// cameraHolder: child of playerObject, pitch rotation applied here
export const cameraHolder = new THREE.Object3D()
cameraHolder.position.set(0, 1.7, 0) // eye height in meters

export const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  100
)

cameraHolder.add(camera)
playerObject.add(cameraHolder)
scene.add(playerObject)
