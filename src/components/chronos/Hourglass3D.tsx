import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, ContactShadows } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

function Sand({ count = 320 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () => new Array(count).fill(0).map(() => ({
      a: Math.random() * Math.PI * 2,
      r: Math.random() * 0.55,
      phase: Math.random(),
      speed: 0.35 + Math.random() * 0.5,
    })),
    [count],
  );

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    seeds.forEach((s, i) => {
      const cycle = ((t * s.speed + s.phase) % 1);
      // top pile shrinking, falling stream, bottom pile growing
      let x = 0, y = 0, z = 0;
      if (i % 5 === 0) {
        // falling stream
        const k = ((t * 1.4 + s.phase) % 1);
        x = (Math.random() - 0.5) * 0.02;
        y = 0.45 - k * 0.9;
        z = (Math.random() - 0.5) * 0.02;
      } else if (cycle < 0.5) {
        // top pile
        const fall = cycle / 0.5;
        const r = s.r * (1 - fall * 0.9);
        x = Math.cos(s.a) * r;
        z = Math.sin(s.a) * r;
        y = 0.35 + (1 - fall) * 0.2 - r * 0.5;
      } else {
        // bottom pile
        const grow = (cycle - 0.5) / 0.5;
        const r = s.r * (0.2 + grow * 0.9);
        x = Math.cos(s.a) * r;
        z = Math.sin(s.a) * r;
        y = -0.95 + r * 0.6 + grow * 0.05;
      }
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(0.018);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial color={"#D8B06A"} emissive={"#B7863B"} emissiveIntensity={0.25} roughness={0.6} />
    </instancedMesh>
  );
}

function GlassBulb({ y, flip = false }: { y: number; flip?: boolean }) {
  // Conical bulb formed from a lathe geometry
  const points = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const yy = t * 0.9;
      // profile: wide at top tapering to narrow neck
      const r = 0.6 * Math.pow(1 - t, 1.4) + 0.04;
      pts.push(new THREE.Vector2(r, yy));
    }
    return pts;
  }, []);
  return (
    <mesh position={[0, y, 0]} rotation={[flip ? Math.PI : 0, 0, 0]}>
      <latheGeometry args={[points, 64]} />
      <meshPhysicalMaterial
        transmission={0.95}
        thickness={0.3}
        roughness={0.08}
        ior={1.45}
        clearcoat={1}
        clearcoatRoughness={0.05}
        color={"#F4EFE4"}
        attenuationColor={"#E8DCC2"}
        attenuationDistance={2}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function Frame() {
  const cap = (y: number) => (
    <mesh position={[0, y, 0]} castShadow>
      <cylinderGeometry args={[0.7, 0.72, 0.06, 64]} />
      <meshStandardMaterial color={"#0E2A47"} metalness={0.6} roughness={0.35} />
    </mesh>
  );
  const pillar = (x: number, z: number) => (
    <mesh position={[x, 0, z]} castShadow>
      <cylinderGeometry args={[0.025, 0.025, 1.95, 16]} />
      <meshStandardMaterial color={"#B7863B"} metalness={0.85} roughness={0.25} />
    </mesh>
  );
  const angles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
  const r = 0.62;
  return (
    <group>
      {cap(0.96)}
      {cap(-0.96)}
      {angles.map((a, i) => pillar(Math.cos(a) * r, Math.sin(a) * r))}
    </group>
  );
}

function HourglassScene() {
  const group = useRef<THREE.Group>(null!);
  useFrame((s) => {
    if (group.current) group.current.rotation.y = Math.sin(s.clock.getElapsedTime() * 0.25) * 0.35;
  });
  return (
    <Float speed={1.1} rotationIntensity={0.2} floatIntensity={0.6}>
      <group ref={group}>
        <Frame />
        {/* top bulb */}
        <GlassBulb y={0.0} />
        {/* bottom bulb (mirrored) */}
        <GlassBulb y={0.0} flip />
        <Sand />
      </group>
    </Float>
  );
}

interface Props { className?: string; compact?: boolean }

export default function Hourglass3D({ className, compact = false }: Props) {
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0.2, 4.2], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.45} />
          <directionalLight position={[3, 4, 3]} intensity={1.4} castShadow />
          <directionalLight position={[-3, 2, -2]} intensity={0.5} color={"#D8B06A"} />
          <HourglassScene />
          {!compact && (
            <ContactShadows position={[0, -1.25, 0]} opacity={0.35} scale={6} blur={2.6} far={2} />
          )}
          <Environment preset="studio" />
        </Suspense>
      </Canvas>
    </div>
  );
}
