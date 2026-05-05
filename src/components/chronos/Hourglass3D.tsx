import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, ContactShadows } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Chronos — Hourglass                                                */
/*                                                                     */
/*  A stylized hourglass built around a single radial profile R(y).    */
/*  The same profile drives:                                           */
/*    • the glass mesh (lathed)                                        */
/*    • the inner sand piles (clipped inside R(y))                     */
/*    • the falling stream (constrained to the neck radius)            */
/*                                                                     */
/*  This guarantees the sand never visually escapes the glass.         */
/* ------------------------------------------------------------------ */

const TOP_Y = 1.05;
const BOT_Y = -1.05;
const NECK_Y = 0.0;
const NECK_R = 0.055;
const BULB_R = 0.62;

/** Smooth bell profile: wide at the top/bottom, pinched at the neck. */
function bulbRadius(y: number): number {
  // y in [-1.05, 1.05]; symmetric around 0
  const yn = Math.min(Math.abs(y) / TOP_Y, 1);
  // Ease-out curve — wide flat shoulder near the cap, smooth pinch to neck
  // R(yn=0)=NECK_R ; R(yn=1)=BULB_R
  const t = Math.pow(yn, 0.85);
  return NECK_R + (BULB_R - NECK_R) * t;
}

function GlassShell() {
  const points = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const N = 64;
    for (let i = 0; i <= N; i++) {
      const y = BOT_Y + (i / N) * (TOP_Y - BOT_Y);
      pts.push(new THREE.Vector2(bulbRadius(y), y));
    }
    return pts;
  }, []);
  return (
    <mesh>
      <latheGeometry args={[points, 96]} />
      <meshPhysicalMaterial
        color={"#F4EFE4"}
        transmission={0.92}
        thickness={0.35}
        roughness={0.08}
        ior={1.46}
        clearcoat={1}
        clearcoatRoughness={0.05}
        attenuationColor={"#E8DCC2"}
        attenuationDistance={2.4}
        transparent
        opacity={0.55}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function SandPiles({ count = 220 }: { count?: number }) {
  // Two static piles — top pile shrinking, bottom pile growing — driven
  // by a global "fill" parameter that loops 0 -> 1.
  const topRef = useRef<THREE.InstancedMesh>(null!);
  const botRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Pre-compute random angular positions and radial seeds in [0,1].
  const seeds = useMemo(
    () =>
      new Array(count).fill(0).map(() => ({
        a: Math.random() * Math.PI * 2,
        // bias toward the outer radii so the pile reads as a cone
        u: Math.sqrt(Math.random()),
        jitter: (Math.random() - 0.5) * 0.012,
      })),
    [count],
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const cycle = (t * 0.06) % 1; // slow, ceremonial
    const topFill = 1 - cycle;    // 1 -> 0
    const botFill = cycle;        // 0 -> 1

    // ---------- Top pile (cone sitting on the funnel) ------------------
    const topApex = NECK_Y + 0.04;
    const topMaxBase = BULB_R - 0.06;
    const topBaseR = topMaxBase * Math.pow(topFill, 0.5);
    const topHeight = 0.55 * Math.pow(topFill, 0.7);
    seeds.forEach((s, i) => {
      // height inside cone, biased toward the bottom
      const h = Math.pow(Math.random(), 1.2);
      const r = topBaseR * (1 - h) * s.u;
      const x = Math.cos(s.a) * r;
      const z = Math.sin(s.a) * r;
      const y = topApex + h * topHeight;
      // clamp inside glass profile
      const maxR = Math.max(NECK_R, bulbRadius(y) - 0.02);
      const cr = Math.min(Math.hypot(x, z), maxR);
      const ang = Math.atan2(z, x);
      dummy.position.set(Math.cos(ang) * cr, y + s.jitter, Math.sin(ang) * cr);
      dummy.scale.setScalar(0.022);
      dummy.updateMatrix();
      topRef.current.setMatrixAt(i, dummy.matrix);
    });
    topRef.current.instanceMatrix.needsUpdate = true;
    topRef.current.visible = topFill > 0.02;

    // ---------- Bottom pile (mound rising from the floor) --------------
    const botFloor = BOT_Y + 0.04;
    const botMaxBase = BULB_R - 0.06;
    const botBaseR = botMaxBase * Math.pow(botFill, 0.45);
    const botHeight = 0.5 * Math.pow(botFill, 0.7);
    seeds.forEach((s, i) => {
      const h = Math.pow(Math.random(), 1.4);
      const r = botBaseR * (1 - h * 0.85) * s.u;
      const x = Math.cos(s.a) * r;
      const z = Math.sin(s.a) * r;
      const y = botFloor + h * botHeight;
      const maxR = Math.max(NECK_R, bulbRadius(y) - 0.02);
      const cr = Math.min(Math.hypot(x, z), maxR);
      const ang = Math.atan2(z, x);
      dummy.position.set(Math.cos(ang) * cr, y + s.jitter, Math.sin(ang) * cr);
      dummy.scale.setScalar(0.022);
      dummy.updateMatrix();
      botRef.current.setMatrixAt(i, dummy.matrix);
    });
    botRef.current.instanceMatrix.needsUpdate = true;
    botRef.current.visible = botFill > 0.02;
  });

  const sandMat = (
    <meshStandardMaterial
      color={"#D8B06A"}
      emissive={"#8c5a1e"}
      emissiveIntensity={0.15}
      roughness={0.85}
      metalness={0.05}
    />
  );

  return (
    <group>
      <instancedMesh ref={topRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 6, 6]} />
        {sandMat}
      </instancedMesh>
      <instancedMesh ref={botRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 6, 6]} />
        {sandMat}
      </instancedMesh>
    </group>
  );
}

function SandStream() {
  // A continuous slim cylinder of sand from neck to the bottom pile,
  // animated with a subtle UV-like shimmer via vertex displacement.
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((s) => {
    if (!ref.current) return;
    // micro wobble so it doesn't look frozen
    ref.current.rotation.y = Math.sin(s.clock.getElapsedTime() * 4) * 0.02;
    const m = ref.current.material as THREE.MeshStandardMaterial;
    m.emissiveIntensity = 0.35 + Math.sin(s.clock.getElapsedTime() * 6) * 0.05;
  });
  const length = NECK_Y - (BOT_Y + 0.08);
  return (
    <mesh ref={ref} position={[0, NECK_Y - length / 2, 0]}>
      <cylinderGeometry args={[NECK_R * 0.45, NECK_R * 0.7, length, 16, 1, true]} />
      <meshStandardMaterial
        color={"#E6BE7C"}
        emissive={"#B7863B"}
        emissiveIntensity={0.4}
        roughness={0.7}
        metalness={0.1}
        transparent
        opacity={0.95}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function StreamSparkles({ count = 24 }: { count?: number }) {
  // A few tiny grains visibly falling along the stream — sells the motion.
  const ref = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () => new Array(count).fill(0).map(() => ({ phase: Math.random(), a: Math.random() * Math.PI * 2 })),
    [count],
  );
  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    seeds.forEach((sd, i) => {
      const k = (t * 1.4 + sd.phase) % 1;
      const y = NECK_Y - k * (NECK_Y - (BOT_Y + 0.1));
      const r = NECK_R * 0.25;
      dummy.position.set(Math.cos(sd.a) * r, y, Math.sin(sd.a) * r);
      dummy.scale.setScalar(0.014);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial color={"#F2D9A6"} emissive={"#C9962F"} emissiveIntensity={0.6} roughness={0.5} />
    </instancedMesh>
  );
}

function Frame() {
  const cap = (y: number) => (
    <group position={[0, y, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[BULB_R + 0.08, BULB_R + 0.05, 0.07, 64]} />
        <meshStandardMaterial color={"#0E2A47"} metalness={0.55} roughness={0.32} />
      </mesh>
      <mesh position={[0, y > 0 ? 0.045 : -0.045, 0]}>
        <torusGeometry args={[BULB_R + 0.06, 0.012, 12, 64]} />
        <meshStandardMaterial color={"#B7863B"} metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
  const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  const r = BULB_R + 0.04;
  return (
    <group>
      {cap(TOP_Y + 0.04)}
      {cap(BOT_Y - 0.04)}
      {angles.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, (TOP_Y - BOT_Y) + 0.18, 16]} />
          <meshStandardMaterial color={"#B7863B"} metalness={0.85} roughness={0.22} />
        </mesh>
      ))}
    </group>
  );
}

function HourglassScene() {
  const group = useRef<THREE.Group>(null!);
  useFrame((s) => {
    if (group.current) {
      group.current.rotation.y = Math.sin(s.clock.getElapsedTime() * 0.22) * 0.32;
    }
  });
  return (
    <Float speed={1.0} rotationIntensity={0.15} floatIntensity={0.45}>
      <group ref={group}>
        <Frame />
        <SandPiles />
        <SandStream />
        <StreamSparkles />
        {/* Glass last so transmission composites over the sand */}
        <GlassShell />
      </group>
    </Float>
  );
}

interface Props {
  className?: string;
  compact?: boolean;
}

export default function Hourglass3D({ className, compact = false }: Props) {
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0.1, 4.8], fov: 32 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[3, 4, 3]} intensity={1.3} castShadow />
          <directionalLight position={[-3, 2, -2]} intensity={0.45} color={"#D8B06A"} />
          <pointLight position={[0, 0, 2]} intensity={0.4} color={"#E6BE7C"} />
          <HourglassScene />
          {!compact && (
            <ContactShadows position={[0, BOT_Y - 0.18, 0]} opacity={0.32} scale={6} blur={2.6} far={2} />
          )}
          <Environment preset="studio" />
        </Suspense>
      </Canvas>
    </div>
  );
}