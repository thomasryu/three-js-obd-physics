import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as dat from 'dat.gui'
import * as CANNON from 'cannon'

/*
 * Debug
 */
const gui = new dat.GUI()
const debugObject = {}

debugObject.createObd = () => createObd()
gui.add(debugObject, 'createObd')

// Reset
debugObject.reset = () => {
  for (const object of objectsToUpdate) {
    object.body.removeEventListener('collide', playHitSound)
    world.removeBody(object.body)
    scene.remove(object.mesh)
  }
}
gui.add(debugObject, 'reset')

/*
 * Base
 */
const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
}

window.addEventListener('resize', () => {
  // Update sizes
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight

  // Update camera
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()

  // Update renderer
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/*
 * Sounds
 */
const hitSound = new Audio('/sounds/hit.mp3')
const playHitSound = (collision) => {
  const impactStrength = collision.contact.getImpactVelocityAlongNormal()

  if (impactStrength > 1.5) {
    hitSound.volume = Math.random() * 0.5
    hitSound.currentTime = 0
    hitSound.play()
  }
}

/*
 * Physics
 */
const world = new CANNON.World()
world.broadphase = new CANNON.SAPBroadphase(world)
world.allowSleep = true
world.gravity.set(0, -9.82, 0)

// Material
const defaultMaterial = new CANNON.Material('default')
const defaultContactMaterial = new CANNON.ContactMaterial(
  defaultMaterial,
  defaultMaterial,
  {
    friction: 0.1,
    restitution: 0.7,
  }
)
world.defaultContactMaterial = defaultContactMaterial

// Floor
const floorShape = new CANNON.Plane()
const floorBody = new CANNON.Body()
floorBody.mass = 0
floorBody.addShape(floorShape)
floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5)
world.addBody(floorBody)

/*
 * Utils
 */
const gltfLoader = new GLTFLoader()
const objectsToUpdate = []

// OBD wireframe debug
const scale = 0.01
const obdBodySize = [10, 12, 6.5]
const obdPlugSize = [8.5, 2.5, 3.5]
const obdBodyOffset = -1.8
const obdPlugOffset = 5.5

const obdBodyGeometry = new THREE.BoxGeometry(...obdBodySize)
const obdPlugGeometry = new THREE.BoxGeometry(...obdPlugSize)
const obdMaterial = new THREE.MeshStandardMaterial({
  color: 'red',
  transparent: true,
  opacity: 0,
})
const obdGroup = new THREE.Group()
const obdBodyMesh = new THREE.Mesh(obdBodyGeometry, obdMaterial)
const obdPlugMesh = new THREE.Mesh(obdPlugGeometry, obdMaterial)
obdBodyMesh.position.y = obdBodyOffset
obdPlugMesh.position.y = obdPlugOffset
obdGroup.castShadow = true
obdGroup.add(obdBodyMesh, obdPlugMesh)

// Create OBD
const createObd = () => {
  // Three.js body
  gltfLoader.load('/models/obd.gltf', (gltf) => {
    const position = [
      Math.random() - 0.5,
      Math.random() * 2 + 3,
      Math.random() - 0.5,
    ]

    const wireframe = obdGroup.clone()

    wireframe.scale.set(scale, scale, scale)
    wireframe.position.set(...position)

    const obd = gltf.scene
    obd.scale.set(scale, scale, scale)
    obd.position.set(...position)

    obd.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true
      }
    })

    scene.add(obd, wireframe)

    // Cannon.js body
    const obdBodyShape = new CANNON.Box(
      new CANNON.Vec3(
        (obdBodySize[0] * scale) / 2,
        (obdBodySize[1] * scale) / 2,
        (obdBodySize[2] * scale) / 2
      )
    )
    const obdPlugShape = new CANNON.Box(
      new CANNON.Vec3(
        (obdPlugSize[0] * scale) / 2,
        (obdPlugSize[1] * scale) / 2,
        (obdPlugSize[2] * scale) / 2
      )
    )
    const obdBody = new CANNON.Body({
      mass: 1,
      material: defaultMaterial,
    })
    obdBody.addShape(obdBodyShape, new CANNON.Vec3(0, obdBodyOffset * scale, 0))
    obdBody.addShape(obdPlugShape, new CANNON.Vec3(0, obdPlugOffset * scale, 0))
    obdBody.position.copy(obd.position)
    obdBody.addEventListener('collide', playHitSound)
    world.addBody(obdBody)

    objectsToUpdate.push({ mesh: obd, body: obdBody, debug: wireframe })
  })
}

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100
)
camera.position.x = 1
camera.position.y = 1
camera.position.z = 1
scene.add(camera)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

// Floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({
    color: '#444444',
    metalness: 0,
    roughness: 0.5,
  })
)
floor.receiveShadow = true
floor.rotation.x = Math.PI / -2
scene.add(floor)

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.camera.far = 15
directionalLight.shadow.camera.left = -7
directionalLight.shadow.camera.top = 7
directionalLight.shadow.camera.right = 7
directionalLight.shadow.camera.bottom = -7
directionalLight.position.set(5, 5, 5)
scene.add(directionalLight)

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor('#262837')

// Animation
const clock = new THREE.Clock()
let lastElapsedTime = 0

const tick = () => {
  const elapsedTime = clock.getElapsedTime()
  const deltaTime = elapsedTime - lastElapsedTime
  lastElapsedTime = elapsedTime

  // Update physics
  world.step(1 / 60, deltaTime, 3)

  for (const object of objectsToUpdate) {
    object.mesh.position.copy(object.body.position)
    object.mesh.quaternion.copy(object.body.quaternion)
    object.debug.position.copy(object.body.position)
    object.debug.quaternion.copy(object.body.quaternion)
  }

  controls.update()
  renderer.render(scene, camera)
  window.requestAnimationFrame(tick)
}

tick()
