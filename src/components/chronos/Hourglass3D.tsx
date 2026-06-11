import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, ContactShadows } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

class ThreeErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return this.props.fallback ?? null;
    return this.props.children;
  }
}

const TOP_Y = 1.05;
const BOT_Y = -1.05;
const NECK_Y = 0.0;
const NECK_R = 0.055;
const BULB_R = 0.62;

const POUR_DURATION = 30;
const FLIP_DURATION = 1.5;
const SETTLE_DURATION = 0.6;

type Phase = "pouring" | "flipping" | "settling";

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function shellR(y: number): number {
  const yn = Math.min(Math.abs(y) / TOP_Y, 1);
  return NECK_R + (BULB_R - NECK_R) * Math.pow(yn, 0.82);
}

function GlassShell() {
  const pts = useMemo(() => {
    const arr: THREE.Vector2[] = [];
    for (let i = 0; i <= 80; i++) {
      const y = BOT_Y + (i / 80) * (TOP_Y - BOT_Y);
      arr.push(new THREE.Vector2(shellR(y), y));
    }
    return arr;
  }, []);

  return (
    <mesh>
      <latheGeometry args={[pts, 120]} />
      <meshPhysicalMaterial
        color="#EDE8DC"
        transmission={0.93}
        thickness={0.28}
        roughness={0.05}
        ior={1.45}
        clearcoat={1}
        clearcoatRoughness={0.04}
        attenuationColor="#DDD0A8"
        attenuationDistance={2.4}
        transparent
        opacity={0.48}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Frame() {
  const CAP_OUTER = BULB_R + 0.07;
  const CAP_INNER = BULB_R + 0.04;
  const CAP_H = 0.062;
  const RING_R = BULB_R + 0.055;
  const RING_TUBE = 0.011;
  const PILLAR_R = BULB_R * 0.84;
  const PILLAR_H = TOP_Y - BOT_Y + 0.08;
  const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

  const Cap = ({ y }: { y: number }) => (
    <group position={[0, y, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[CAP_OUTER, CAP_INNER, CAP_H, 72]} />
        <meshStandardMaterial color="#0D2540" metalness={0.65} roughness={0.28} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RING_R, RING_TUBE, 14, 90]} />
        <meshStandardMaterial color="#C4922A" metalness={0.93} roughness={0.16} />
      </mesh>
    </group>
  );

  return (
    <group>
      <Cap y={TOP_Y + 0.031} />
      <Cap y={BOT_Y - 0.031} />
      {angles.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * PILLAR_R, 0, Math.sin(a) * PILLAR_R]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, PILLAR_H, 16]} />
          <meshStandardMaterial color="#C4922A" metalness={0.88} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

const GRAIN_COUNT = 700;
const FALL_COUNT = 32;
const GRAIN_SCALE = 0.0078;

function Sand() {
  // pileSrcRef = draining pile, pileDstRef = receiving pile
  const pileSrcRef = useRef<THREE.InstancedMesh>(null!);
  const pileDstRef = useRef<THREE.InstancedMesh>(null!);
  const fallingRef = useRef<THREE.InstancedMesh>(null!);
  const streamDownRef = useRef<THREE.Mesh>(null!);
  const streamUpRef = useRef<THREE.Mesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const flipGroup = useRef<THREE.Group>(null!);
  const swayGroup = useRef<THREE.Group>(null!);

  const seeds = useMemo(
    () =>
      Array.from({ length: GRAIN_COUNT }, () => ({
        angle: Math.random() * Math.PI * 2,
        radial: Math.random(),
        height: Math.random(),
        jx: (Math.random() - 0.5) * 0.006,
        jz: (Math.random() - 0.5) * 0.006,
      })),
    [],
  );

  const fallSeeds = useMemo(
    () =>
      Array.from({ length: FALL_COUNT }, (_, i) => ({
        phase: i / FALL_COUNT,
        jx: (Math.random() - 0.5) * 0.01,
        jz: (Math.random() - 0.5) * 0.01,
      })),
    [],
  );

  const phase = useRef<Phase>("pouring");
  const pourT = useRef(0);
  const flipT = useRef(0);
  const settleT = useRef(0);
  const inverted = useRef(false);
  const baseRotX = useRef(0);

  // Local-space pile anchors — updated on every flip completion so the logic
  // stays correct across an unlimited number of cycles.
  //
  // "direction" controls which way the pile grows from its anchor:
  //   +1 → grains placed above anchorY (toward local +Y)
  //   -1 → grains placed below anchorY (toward local -Y)
  //
  // Why this matters after a flip: the flipGroup rotates 180° around X, which
  // negates local Y in world space.  A pile at local BOT_Y+0.04 that was at
  // the visual bottom appears at the visual top after the flip.  By choosing
  // the anchor and direction of the *next* destination pile to lie in the
  // opposite bulb (and grow toward the neck from that bulb's cap), the pile
  // always ends up at the correct visual position regardless of how many flips
  // have occurred.
  const srcAnchorY = useRef(NECK_Y + 0.02);
  const srcDir = useRef<1 | -1>(1);
  // Cycle 1: destination is the south bulb, grows upward from cap toward neck
  const dstAnchorY = useRef(BOT_Y + 0.04);
  const dstDir = useRef<1 | -1>(1);
  const settleSrcFromAnchorY = useRef(dstAnchorY.current);
  const settleSrcFromDir = useRef<number>(dstDir.current);

  // placePile places GRAIN_COUNT instanced grains as a conical heap.
  // anchorY is the base (widest point); the pile grows in `direction` from there.
  const placePile = (
    anchorY: number,
    fill: number,
    direction: number,
    ref: React.RefObject<THREE.InstancedMesh>,
  ) => {
    if (!ref.current) return;
    if (fill <= 0.01) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;

    const baseR = (BULB_R - 0.06) * Math.pow(fill, 0.46);
    const pileH = 0.5 * Math.pow(fill, 0.76);

    for (let i = 0; i < GRAIN_COUNT; i++) {
      const s = seeds[i];
      const hFrac = Math.pow(s.height, 0.85);
      // Grow in `direction` — base at anchorY, tip further away
      const y = anchorY + direction * hFrac * pileH;
      const coneR = baseR * (1 - hFrac * 0.9);
      const r = coneR * Math.sqrt(s.radial);
      let px = Math.cos(s.angle) * r + s.jx;
      let pz = Math.sin(s.angle) * r + s.jz;
      const maxW = Math.max(NECK_R + 0.004, shellR(y) - 0.016);
      const dist = Math.sqrt(px * px + pz * pz);
      if (dist > maxW) {
        const sc = maxW / dist;
        px *= sc;
        pz *= sc;
      }

      dummy.position.set(px, y, pz);
      dummy.scale.setScalar(GRAIN_SCALE);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  };

  const placeFalling = (t: number, toBottom: boolean) => {
    if (!fallingRef.current) return;
    fallingRef.current.visible = true;
    const start = NECK_Y;
    // toBottom=true  → grains travel toward local -Y (normal orientation)
    // toBottom=false → grains travel toward local +Y (inverted; after world
    //                  transform this still appears as falling downward)
    const end = toBottom ? BOT_Y + 0.1 : TOP_Y - 0.1;
    const span = end - start;

    for (let i = 0; i < FALL_COUNT; i++) {
      const s = fallSeeds[i];
      const k = (t * 1.05 + s.phase) % 1;
      const y = start + k * k * span;
      const spread = 0.9 + k * 1.4;
      dummy.position.set(s.jx * spread, y, s.jz * spread);
      dummy.scale.setScalar(GRAIN_SCALE * 0.88);
      dummy.updateMatrix();
      fallingRef.current.setMatrixAt(i, dummy.matrix);
    }
    fallingRef.current.instanceMatrix.needsUpdate = true;
  };

  useFrame((state, delta) => {
    if (!flipGroup.current) return;
    const t = state.clock.getElapsedTime();

    if (swayGroup.current) {
      swayGroup.current.rotation.y = Math.sin(t * 0.15) * 0.2;
    }

    if (phase.current === "pouring") {
      pourT.current = Math.min(1, pourT.current + delta / POUR_DURATION);

      placePile(srcAnchorY.current, 1 - pourT.current, srcDir.current, pileSrcRef);
      placePile(dstAnchorY.current, pourT.current, dstDir.current, pileDstRef);
      placeFalling(t, !inverted.current);

      // streamDown spans from neck toward local -Y (correct when not inverted)
      // streamUp  spans from neck toward local +Y (correct when inverted, since
      //           the world transform maps local +Y → visual -Y = downward)
      if (streamDownRef.current) streamDownRef.current.visible = !inverted.current;
      if (streamUpRef.current) streamUpRef.current.visible = inverted.current;

      if (pourT.current >= 0.98) {
        phase.current = "flipping";
        flipT.current = 0;
      }
    } else if (phase.current === "flipping") {
      flipT.current = Math.min(1, flipT.current + delta / FLIP_DURATION);
      const eased = easeInOutCubic(flipT.current);

      if (fallingRef.current) fallingRef.current.visible = false;
      if (streamDownRef.current) streamDownRef.current.visible = false;
      if (streamUpRef.current) streamUpRef.current.visible = false;

      // Hold end-of-pour state: source empty, destination full.
      // Both piles rotate with the glass — no position change needed here.
      placePile(srcAnchorY.current, 0, srcDir.current, pileSrcRef);
      placePile(dstAnchorY.current, 1, dstDir.current, pileDstRef);

      flipGroup.current.rotation.x = baseRotX.current + eased * Math.PI;

      if (flipT.current >= 1) {
        baseRotX.current = (baseRotX.current + Math.PI) % (Math.PI * 2);
        flipGroup.current.rotation.x = baseRotX.current;
        inverted.current = !inverted.current;

        // The full destination pile right before re-anchoring is the visual
        // starting point for the short settle/reform animation.
        settleSrcFromAnchorY.current = dstAnchorY.current;
        settleSrcFromDir.current = dstDir.current;

        // Re-establish anchors by orientation so each new cycle starts from a
        // neck-adjacent source in the current upper bulb (never ceiling-glued).
        if (inverted.current) {
          // Visual top is local lower bulb after 180° rotation around X.
          srcAnchorY.current = NECK_Y - 0.02;
          srcDir.current = -1;
          dstAnchorY.current = TOP_Y - 0.04;
          dstDir.current = -1;
        } else {
          srcAnchorY.current = NECK_Y + 0.02;
          srcDir.current = 1;
          dstAnchorY.current = BOT_Y + 0.04;
          dstDir.current = 1;
        }

        pourT.current = 0;
        phase.current = "settling";
        settleT.current = 0;
      }
    } else {
      // settling — stream and falling grains hidden
      if (fallingRef.current) fallingRef.current.visible = false;
      if (streamDownRef.current) streamDownRef.current.visible = false;
      if (streamUpRef.current) streamUpRef.current.visible = false;

      // Smoothly reform the source pile from the cap-side shape to the
      // neck-adjacent source shape, avoiding any teleport feel after flips.
      const settleK = Math.min(1, settleT.current / SETTLE_DURATION);
      const easedSettleK = easeInOutCubic(settleK);
      const animatedSrcAnchor = THREE.MathUtils.lerp(
        settleSrcFromAnchorY.current,
        srcAnchorY.current,
        easedSettleK,
      );
      const animatedSrcDir = THREE.MathUtils.lerp(
        settleSrcFromDir.current,
        srcDir.current,
        easedSettleK,
      );

      // Show the freshly promoted source as full while destination stays empty.
      placePile(animatedSrcAnchor, 1, animatedSrcDir, pileSrcRef);
      placePile(dstAnchorY.current, 0, dstDir.current, pileDstRef);

      settleT.current += delta;
      if (settleT.current >= SETTLE_DURATION) {
        phase.current = "pouring";
      }
    }
  });

  const streamH = Math.abs(NECK_Y - (BOT_Y + 0.06));

  return (
    <group ref={flipGroup}>
      <Float speed={0.75} rotationIntensity={0} floatIntensity={0.22}>
        <group ref={swayGroup} scale={1.02} position={[0, -0.08, 0]}>
          <Frame />
          <GlassShell />

          <instancedMesh ref={pileSrcRef} args={[undefined, undefined, GRAIN_COUNT]}>
            <sphereGeometry args={[1, 7, 6]} />
            <meshStandardMaterial color="#C8A248" emissive="#6B3E0A" emissiveIntensity={0.06} roughness={0.94} metalness={0} />
          </instancedMesh>

          <instancedMesh ref={pileDstRef} args={[undefined, undefined, GRAIN_COUNT]}>
            <sphereGeometry args={[1, 7, 6]} />
            <meshStandardMaterial color="#C8A248" emissive="#6B3E0A" emissiveIntensity={0.06} roughness={0.94} metalness={0} />
          </instancedMesh>

          <instancedMesh ref={fallingRef} args={[undefined, undefined, FALL_COUNT]}>
            <sphereGeometry args={[1, 6, 5]} />
            <meshStandardMaterial color="#DDBB60" emissive="#A07020" emissiveIntensity={0.18} roughness={0.8} />
          </instancedMesh>

          <mesh ref={streamDownRef} position={[0, NECK_Y - streamH / 2, 0]}>
            <cylinderGeometry args={[NECK_R * 0.16, NECK_R * 0.28, streamH, 12, 1, true]} />
            <meshStandardMaterial color="#D4A840" emissive="#906010" emissiveIntensity={0.2} roughness={0.85} transparent opacity={0.62} side={THREE.DoubleSide} />
          </mesh>

          <mesh ref={streamUpRef} position={[0, NECK_Y + streamH / 2, 0]}>
            <cylinderGeometry args={[NECK_R * 0.16, NECK_R * 0.28, streamH, 12, 1, true]} />
            <meshStandardMaterial color="#D4A840" emissive="#906010" emissiveIntensity={0.2} roughness={0.85} transparent opacity={0.62} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </Float>
    </group>
  );
}

interface Props { className?: string; compact?: boolean; }

export default function Hourglass3D({ className, compact = false }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 350);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className={`${className ?? ""} relative h-full w-full`}>
      {!ready && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-midnight/70 backdrop-blur-sm transition-opacity duration-300">
          <div className="flex flex-col items-center gap-3 text-primary-foreground/85">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-secondary/30 border-t-secondary" />
            <span className="text-[11px] uppercase tracking-[0.22em] text-secondary-soft">Carregando Chronos</span>
          </div>
        </div>
      )}
      <ThreeErrorBoundary>
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [0, 0, 5.8], fov: 30 }}
          gl={{ antialias: true, alpha: true }}
          onCreated={() => setReady(true)}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[3, 5, 3]} intensity={1.25} castShadow />
            <directionalLight position={[-3, 2, -2]} intensity={0.36} color="#D8B06A" />
            <pointLight position={[0, 0, 2.5]} intensity={0.28} color="#E6C87C" />
            <Sand />
            {!compact && (
              <ContactShadows position={[0, BOT_Y - 0.22, 0]} opacity={0.24} scale={5} blur={2.2} far={2} />
            )}
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
      </ThreeErrorBoundary>
    </div>
  );
}

