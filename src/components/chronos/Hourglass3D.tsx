import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, ContactShadows } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

/* Chronos — Hourglass
   Stable, low-noise sand: piles are pre-seeded ONCE; frame updates only
   move existing instances along Y, never re-randomize positions. */

const TOP_Y = 1.05;
const BOT_Y = -1.05;
const NECK_Y = 0.0;
const NECK_R = 0.055;
const BULB_R = 0.62;

function bulbRadius(y: number): number {
  const yn = Math.min(Math.abs(y) / TOP_Y, 1);
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

/**
 * SandPiles
 * Each grain has a fixed (a, u, hSeed) generated ONCE.
 * Per-frame we only scale the cone size by `fill`, never reshuffle.
 */
function SandPiles({ count = 260 }: { count?: number }) {
  const topRef = useRef<THREE.InstancedMesh>(null!);
  const botRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Stable seeds: angle, radial seed, height seed — deterministic pile shape.
  const seeds = useMemo(() => {
    return new Array(count).fill(0).map(() => ({
      a: Math.random() * Math.PI * 2,
      u: Math.sqrt(Math.random()),
      h: Math.random(),
    }));
  }, [count]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const cycle = (t * 0.05) % 1;
    const topFill = 1 - cycle;
    const botFill = cycle;

    // Top pile
    const topApex = NECK_Y + 0.04;
    const topMaxBase = BULB_R - 0.06;
    const topBaseR = topMaxBase * Math.pow(topFill, 0.5);
    const topHeight = 0.55 * Math.pow(topFill, 0.7);

    seeds.forEach((s, i) => {
      const h = Math.pow(s.h, 1.2);
      const r = topBaseR * (1 - h) * s.u;
      const x = Math.cos(s.a) * r;
      const z = Math.sin(s.a) * r;
      const y = topApex + h * topHeight;
      const maxR = Math.max(NECK_R, bulbRadius(y) - 0.02);
      const cr = Math.min(Math.hypot(x, z), maxR);
      const ang = Math.atan2(z, x);
      dummy.position.set(Math.cos(ang) * cr, y, Math.sin(ang) * cr);
      dummy.scale.setScalar(0.022);
      dummy.updateMatrix();
      topRef.current.setMatrixAt(i, dummy.matrix);
    });
    topRef.current.instanceMatrix.needsUpdate = true;
    topRef.current.visible = topFill > 0.02;

    // Bottom pile
    const botFloor = BOT_Y + 0.04;
    const botMaxBase = BULB_R - 0.06;
    const botBaseR = botMaxBase * Math.pow(botFill, 0.45);
    const botHeight = 0.5 * Math.pow(botFill, 0.7);

    seeds.forEach((s, i) => {
      const h = Math.pow(s.h, 1.4);
      const r = botBaseR * (1 - h * 0.85) * s.u;
      const x = Math.cos(s.a) * r;
      const z = Math.sin(s.a) * r;
      const y = botFloor + h * botHeight;
      const maxR = Math.max(NECK_R, bulbRadius(y) - 0.02);
      const cr = Math.min(Math.hypot(x, z), maxR);
      const ang = Math.atan2(z, x);
      dummy.position.set(Math.cos(ang) * cr, y, Math.sin(ang) * cr);
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
      emissiveIntensity={0.12}
      roughness={0.85}
      metalness={0.05}
    />
  );

  return (
    <group>
      <instancedMesh ref={topRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 8, 8]} />
        {sandMat}
      </instancedMesh>
      <instancedMesh ref={botRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 8, 8]} />
        {sandMat}
      </instancedMesh>
    </group>
  );
}

/** Continuous slim stream — silky, no wobble. */
function SandStream() {
  const length = NECK_Y - (BOT_Y + 0.08);
  return (
    <mesh position={[0, NECK_Y - length / 2, 0]}>
      <cylinderGeometry args={[NECK_R * 0.4, NECK_R * 0.6, length, 16, 1, true]} />
      <meshStandardMaterial
        color={"#E6BE7C"}
        emissive={"#B7863B"}
        emissiveIntensity={0.32}
        roughness={0.7}
        metalness={0.1}
        transparent
        opacity={0.95}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** A handful of grains travelling cleanly down the stream (no random reseed). */
function StreamSparkles({ count = 14 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () => new Array(count).fill(0).map((_, i) => ({
      phase: i / count,
      a: (i * 137.5) % (Math.PI * 2),
    })),
    [count],
  );
  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    seeds.forEach((sd, i) => {
      const k = (t * 0.9 + sd.phase) % 1;
      const y = NECK_Y - k * (NECK_Y - (BOT_Y + 0.1));
      const r = NECK_R * 0.22;
      dummy.position.set(Math.cos(sd.a) * r, y, Math.sin(sd.a) * r);
      dummy.scale.setScalar(0.012);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial color={"#F2D9A6"} emissive={"#C9962F"} emissiveIntensity={0.5} roughness={0.5} />
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
      group.current.rotation.y = Math.sin(s.clock.getElapsedTime() * 0.18) * 0.28;
    }
  });
  return (
    <Float speed={0.8} rotationIntensity={0.1} floatIntensity={0.25}>
      <group ref={group} scale={0.88}>
        <Frame />
        <SandPiles />
        <SandStream />
        <StreamSparkles />
        <GlassShell />
      </group>
    </Float>
  );
}

interface Props { className?: string; compact?: boolean; }

export default function Hourglass3D({ className, compact = false }: Props) {
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.0, 5.6], fov: 30 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[3, 4, 3]} intensity={1.2} castShadow />
          <directionalLight position={[-3, 2, -2]} intensity={0.4} color={"#D8B06A"} />
          <pointLight position={[0, 0, 2]} intensity={0.35} color={"#E6BE7C"} />
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
