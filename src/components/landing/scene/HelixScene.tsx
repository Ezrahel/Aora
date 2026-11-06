import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { POSES, sceneStore, type Pose } from "./store";
import { SLABS, TURN, buildProfile, type HelixProfile } from "./shape";

type Theme = "light" | "dark";

interface HelixSceneProps {
  theme: Theme;
  reduced: boolean;
  /** Element whose opacity follows the current pose. */
  layer: HTMLElement | null;
  onFirstFrame: () => void;
}

const VANE_PITCH = 1.12;
const VANE_CHORD = 1.05;
const POSE_KEYS = ["x", "y", "z", "rotX", "rotZ", "scale", "opacity"] as const;

function slabGeometry() {
  const w = 1;
  const d = 0.44;
  const r = 0.05;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -d / 2);
  shape.lineTo(w / 2 - r, -d / 2);
  shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  shape.lineTo(w / 2, d / 2 - r);
  shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  shape.lineTo(-w / 2 + r, d / 2);
  shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  shape.lineTo(-w / 2, -d / 2 + r);
  shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.8,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.1,
    bevelSegments: 2,
    curveSegments: 3,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.center();
  return geometry;
}

/** A small softbox studio rendered once into an environment map. No HDR download. */
function StudioLighting({ theme }: { theme: Theme }) {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    const studio = new THREE.Scene();
    studio.background = new THREE.Color(theme === "dark" ? 0x050505 : 0x8a8a90);
    const panel = (w: number, h: number, power: number, position: [number, number, number]) => {
      const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      material.color.setScalar(power);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
      mesh.position.set(...position);
      mesh.lookAt(0, 0, 0);
      studio.add(mesh);
    };
    panel(14, 3, 3.2, [0, 9, 3]);
    panel(1.1, 18, 7, [-9, 1, 4]);
    panel(0.6, 18, 5, [9, -1, 5]);
    panel(10, 0.8, 2.4, [0, -8, 6]);
    panel(6, 6, 0.7, [3, 2, -10]);
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromScene(studio, 0.03);
    scene.environment = target.texture;
    // Metal renders black until this lands, so it must repaint in on-demand mode too.
    invalidate();
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, theme, invalidate]);
  return null;
}

const particleVertex = /* glsl */ `
  attribute float aU;
  attribute float aSeed;
  attribute float aLane;
  uniform float uTime;
  uniform float uScale;
  uniform float uWave;
  uniform sampler2D uProfile;
  varying float vGlow;

  vec4 profileAt(float s) {
    float lo = floor(s);
    vec4 a = texture2D(uProfile, vec2((lo + 0.5) / ${SLABS}.0, 0.5));
    vec4 b = texture2D(uProfile, vec2((min(lo + 1.0, ${SLABS - 1}.0) + 0.5) / ${SLABS}.0, 0.5));
    return mix(a, b, s - lo);
  }

  void main() {
    float direction = aLane < 0.5 ? 1.0 : -1.0;
    float speed = aLane < 0.5 ? 0.012 : 0.02;
    float u = fract(aU + uTime * speed * direction);
    float s = u * ${SLABS - 1}.0;
    vec4 p = profileAt(s);
    float theta = s * ${TURN.toFixed(3)};

    // Lane 0 rides the outer slab tips (usage), lane 1 the inner tips (payments).
    float edge = aLane < 0.5 ? 0.5 : -0.5;
    float jitter = (aSeed - 0.5) * (aLane < 0.5 ? 0.3 : 0.1);
    float radius = p.x + p.z * edge + jitter;
    vec3 position3 = vec3(cos(theta) * radius, p.y + (fract(aSeed * 7.13) - 0.5) * 0.22, sin(theta) * radius);

    float pulse = exp(-pow((u - uWave) * 16.0, 2.0));
    vGlow = (aLane < 0.5 ? 0.42 : 1.0) * (0.5 + 0.5 * fract(aSeed * 13.7)) + pulse;

    vec4 mv = modelViewMatrix * vec4(position3, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aLane < 0.5 ? 0.8 : 1.15;
    gl_PointSize = (size + pulse * 1.6) * uScale * (0.7 + fract(aSeed * 3.1)) / -mv.z;
  }
`;

const particleFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.1, d);
    gl_FragColor = vec4(uColor, alpha * vGlow * 0.8);
  }
`;

function Helix({ theme, reduced, layer, onFirstFrame }: HelixSceneProps) {
  const rig = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const slabs = useRef<THREE.InstancedMesh>(null);
  const { size, invalidate, setDpr, setFrameloop } = useThree();

  const mobile = size.width < 768;
  const particleCount = mobile ? 3200 : 9000;

  const geometry = useMemo(slabGeometry, []);
  const state = useRef({
    target: buildProfile(sceneStore.plan),
    current: null as HelixProfile | null,
    version: sceneStore.planVersion,
    morphStart: -10,
    introStart: -1,
    spin: 0,
    pose: { ...(sceneStore.heldPose ?? POSES.hero) } as Pose,
    px: 0,
    py: 0,
    stops: [] as { y: number; pose: Pose }[],
    frames: 0,
    governed: false,
    painted: false,
  });

  const profileTexture = useMemo(() => {
    const texture = new THREE.DataTexture(new Float32Array(SLABS * 4), SLABS, 1, THREE.RGBAFormat, THREE.FloatType);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    return texture;
  }, []);

  const particleGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const u = new Float32Array(particleCount);
    const seed = new Float32Array(particleCount);
    const lane = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      u[i] = Math.random();
      seed[i] = Math.random();
      lane[i] = i % 3 === 0 ? 1 : 0;
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(particleCount * 3), 3));
    g.setAttribute("aU", new THREE.BufferAttribute(u, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aLane", new THREE.BufferAttribute(lane, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    return g;
  }, [particleCount]);

  const particleMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: particleVertex,
        fragmentShader: particleFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 40 },
          uWave: { value: -1 },
          uProfile: { value: profileTexture },
          uColor: { value: new THREE.Color() },
        },
      }),
    [profileTexture],
  );

  useEffect(() => {
    const dark = theme === "dark";
    particleMaterial.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    particleMaterial.uniforms.uColor.value.set(dark ? "#F5F5F7" : "#2a2a2e");
    particleMaterial.needsUpdate = true;
    invalidate();
  }, [theme, particleMaterial, invalidate]);

  // Section offsets only change on layout, so read them there and not per frame.
  useLayoutEffect(() => {
    const read = () => {
      const vh = window.innerHeight;
      const stops: { y: number; pose: Pose }[] = [];
      document.querySelectorAll<HTMLElement>("[data-scene]").forEach((node) => {
        const box = node.getBoundingClientRect();
        const top = box.top + window.scrollY;
        const hold = Math.min(box.height * 0.3, vh * 0.35);
        const start = POSES[node.dataset.scene ?? "hero"] ?? POSES.hero;
        const end = POSES[node.dataset.sceneEnd ?? node.dataset.scene ?? "hero"] ?? start;
        stops.push({ y: top + hold, pose: start }, { y: top + box.height - hold, pose: end });
      });
      state.current.stops = stops;
      invalidate();
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(document.body);
    const onScroll = () => invalidate();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [invalidate]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      sceneStore.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
      sceneStore.pointerY = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      profileTexture.dispose();
    },
    [geometry, particleGeometry, particleMaterial, profileTexture],
  );

  const scratch = useMemo(() => ({ object: new THREE.Object3D(), color: new THREE.Color(), pose: { ...POSES.hero } as Pose }), []);

  useFrame((_, delta) => {
    const s = state.current;
    // Not clock.elapsedTime: setFrameloop resets that clock, which would rewind the intro.
    const now = performance.now() / 1000;
    const dt = Math.min(delta, 0.05);
    if (s.introStart < 0) s.introStart = now;

    // Governor: judge the first seconds, then trade fidelity for a responsive page.
    // Below ~12fps the scene stops animating and only repaints when scrolled.
    s.frames += 1;
    if (!s.governed && now - s.introStart > 3) {
      s.governed = true;
      const fps = s.frames / (now - s.introStart);
      if (fps < 30) {
        setDpr(1);
        particleGeometry.setDrawRange(0, Math.floor(particleCount * 0.45));
      }
      if (fps < 12) {
        setFrameloop("demand");
        invalidate();
      }
    }

    if (s.version !== sceneStore.planVersion) {
      s.version = sceneStore.planVersion;
      s.target = buildProfile(sceneStore.plan);
      s.morphStart = now;
    }
    if (!s.current) {
      s.current = {
        radius: s.target.radius.slice(),
        length: s.target.length.slice(),
        thick: s.target.thick.slice(),
        y: s.target.y.slice(),
      };
    }

    // Director: blend poses by where the viewport centre sits among the sections.
    const goal = scratch.pose;
    const held = sceneStore.heldPose;
    if (held) {
      Object.assign(goal, held);
    } else if (s.stops.length) {
      const line = window.scrollY + window.innerHeight / 2;
      const stops = s.stops;
      let from = stops[0];
      let to = stops[0];
      if (line >= stops[stops.length - 1].y) {
        from = to = stops[stops.length - 1];
      } else if (line > stops[0].y) {
        const next = stops.findIndex((stop) => stop.y >= line);
        from = stops[next - 1];
        to = stops[next];
      }
      const span = to.y - from.y;
      const raw = span > 0 ? THREE.MathUtils.clamp((line - from.y) / span, 0, 1) : 0;
      const t = from.pose === to.pose ? raw : raw * raw * (3 - 2 * raw);
      for (const key of POSE_KEYS) goal[key] = from.pose[key] + (to.pose[key] - from.pose[key]) * t;
    }

    // Narrow viewports: centre the helix behind the copy and quieten it.
    const aspect = size.width / size.height;
    const xFit = mobile ? 0 : Math.min(1, aspect / 1.78);
    const pose = s.pose;
    // Uses the true frame time so slow machines still arrive, just in fewer steps.
    const ease = reduced ? 1 : 1 - Math.exp(-delta * 4.5);
    for (const key of POSE_KEYS) {
      const value = key === "x" ? goal.x * xFit : key === "opacity" && mobile ? goal.opacity * 0.34 : goal[key];
      pose[key] += (value - pose[key]) * ease;
    }
    if (layer) layer.style.opacity = pose.opacity.toFixed(3);

    s.px += (sceneStore.pointerX - s.px) * 0.04;
    s.py += (sceneStore.pointerY - s.py) * 0.04;
    if (!reduced) s.spin += dt * 0.09;

    const group = rig.current;
    if (group) {
      group.position.set(pose.x, pose.y, pose.z);
      group.rotation.set(pose.rotX + s.py * 0.05, 0, pose.rotZ + s.px * 0.05);
      group.scale.setScalar(pose.scale);
    }
    if (spin.current) spin.current.rotation.y = s.spin;

    // Slabs: the morph rolls down the helix as a wave rather than snapping.
    const mesh = slabs.current;
    const current = s.current;
    const target = s.target;
    const texture = profileTexture.image.data as unknown as Float32Array;
    const sinceMorph = now - s.morphStart;
    const sinceIntro = reduced ? 10 : now - s.introStart;
    const wave = sinceMorph < 2.4 ? sinceMorph / 1.8 : -1;
    const object = scratch.object;
    const { color } = scratch;
    const dark = theme === "dark";

    if (mesh) {
      for (let i = 0; i < SLABS; i++) {
        const u = i / (SLABS - 1);
        const rate = reduced ? 1 : sinceMorph > u * 1.1 ? 1 - Math.exp(-dt * 6) : 0;
        current.radius[i] += (target.radius[i] - current.radius[i]) * rate;
        current.length[i] += (target.length[i] - current.length[i]) * rate;
        current.thick[i] += (target.thick[i] - current.thick[i]) * rate;
        current.y[i] += (target.y[i] - current.y[i]) * rate;

        const reveal = THREE.MathUtils.smoothstep(sinceIntro - u * 1.5, 0, 1);
        const angle = i * TURN;
        const radius = current.radius[i] * (0.35 + reveal * 0.65);
        object.position.set(Math.cos(angle) * radius, current.y[i], Math.sin(angle) * radius);
        // Vanes, not stairs: pitched like turbine blades so neighbours nest cleanly.
        object.rotation.set(VANE_PITCH, -angle, 0, "YXZ");
        object.scale.set(current.length[i] * reveal, current.thick[i], VANE_CHORD * reveal);
        object.updateMatrix();
        mesh.setMatrixAt(i, object.matrix);

        // A slow reconciliation pulse keeps travelling even when nothing changes.
        const ambient = (now * 0.07 + u * 2) % 1;
        const sweep = Math.exp(-Math.pow((ambient - 0.5) * 9, 2));
        const hit = wave >= 0 ? Math.exp(-Math.pow((u - wave) * 13, 2)) : 0;
        const lift = reduced ? 0.15 : sweep * 0.5 + hit * 1.5;
        const shade = dark ? 0.3 + lift * 0.7 : 0.34 + lift * 0.5;
        mesh.setColorAt(i, color.setScalar(shade));

        const o = i * 4;
        texture[o] = radius;
        texture[o + 1] = current.y[i];
        texture[o + 2] = current.length[i];
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      profileTexture.needsUpdate = true;
    }

    const uniforms = particleMaterial.uniforms;
    uniforms.uTime.value = reduced ? 3 : now;
    uniforms.uWave.value = wave;
    uniforms.uScale.value = (size.height / 900) * 34 * Math.min(window.devicePixelRatio, 1.75);

    if (!s.painted) {
      s.painted = true;
      onFirstFrame();
    }
  });

  return (
    <group ref={rig}>
      <group ref={spin}>
        <instancedMesh ref={slabs} args={[geometry, undefined, SLABS]} frustumCulled={false}>
          <meshStandardMaterial
            key={theme}
            metalness={1}
            roughness={0.36}
          />
        </instancedMesh>
        <points geometry={particleGeometry} material={particleMaterial} frustumCulled={false} />
      </group>
    </group>
  );
}

export default function HelixScene(props: HelixSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={props.reduced ? "demand" : "always"}
      camera={{ position: [0, 0, 15], fov: 32, near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none" }}
    >
      <StudioLighting theme={props.theme} />
      <directionalLight position={[-6, 8, 7]} intensity={props.theme === "dark" ? 1.2 : 1.6} />
      <ambientLight intensity={0.05} />
      <Helix {...props} />
    </Canvas>
  );
}
