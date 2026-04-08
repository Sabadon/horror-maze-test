import * as THREE from 'three'
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass }      from 'three/addons/postprocessing/ShaderPass.js'

const GrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime:    { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float grain = (hash(vUv + fract(uTime * 0.07)) - 0.5) * 0.06;
      gl_FragColor = vec4(color.rgb + grain, color.a);
    }
  `,
}

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer)
  composer.setPixelRatio(1)
  composer.setSize(320, 240)

  composer.addPass(new RenderPass(scene, camera))

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(160, 120),
    0.2,
    0.4,
    0.9
  )
  composer.addPass(bloom)

  const grainPass = new ShaderPass(GrainShader)
  composer.addPass(grainPass)

  return { composer, grainPass }
}
