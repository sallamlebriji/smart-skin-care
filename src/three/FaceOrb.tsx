import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Sparkles, Float } from "@react-three/drei";
import * as THREE from "three";

interface FaceOrbProps {
  reduced?: boolean;
}

/**
 * Abstract, non-literal stand-in for a face/cell mesh (spec §4): a slowly
 * rotating distorted sphere with a wireframe shell and fine particles.
 * Deliberately organic rather than a literal face model — Phase 1 scope
 * doesn't include real facial mesh data (that's the AI pipeline, Phase 4+).
 */
export default function FaceOrb({ reduced = false }: FaceOrbProps) {
  const groupRef = useRef<THREE.Group>(null);
  const wireRef = useRef<THREE.Mesh>(null);

  const sparkleCount = reduced ? 40 : 140;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.18;
    if (wireRef.current) {
      wireRef.current.rotation.y -= delta * 0.09;
    }
  });

  const wireGeo = useMemo(() => new THREE.IcosahedronGeometry(1.62, 2), []);

  return (
    <group ref={groupRef}>
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.6}>
        <mesh>
          <icosahedronGeometry args={[1.35, reduced ? 4 : 12]} />
          <MeshDistortMaterial
            color="#f6f3ff"
            emissive="#cabdf7"
            emissiveIntensity={0.18}
            roughness={0.35}
            metalness={0}
            distort={0.32}
            speed={1.1}
            transparent
            opacity={0.95}
          />
        </mesh>

        <mesh ref={wireRef} geometry={wireGeo}>
          <meshBasicMaterial color="#a99cf5" wireframe transparent opacity={0.22} />
        </mesh>
      </Float>

      {!reduced && (
        <Sparkles
          count={sparkleCount}
          scale={4.2}
          size={2}
          speed={0.25}
          color="#e7a9bc"
          opacity={0.6}
        />
      )}

      <ambientLight intensity={1.1} />
      <directionalLight position={[3, 4, 5]} intensity={1.4} color="#ffffff" />
      <pointLight position={[-3, -2, -2]} intensity={1.2} color="#a99cf5" />
      <pointLight position={[2, -1, 3]} intensity={0.6} color="#f0c9d8" />
    </group>
  );
}
