import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import FaceOrb from "./FaceOrb";
import { useDeviceCapability } from "@/hooks/useDeviceCapability";

/**
 * Static fallback for devices without WebGL, with reduced-motion set, or
 * while the Canvas mounts — never a blank box (spec §4/§24).
 */
function StaticOrb() {
  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        background:
          "radial-gradient(60% 60% at 35% 30%, rgba(169,156,245,0.55), transparent 70%), radial-gradient(55% 55% at 70% 65%, rgba(231,169,188,0.45), transparent 70%), linear-gradient(160deg, #efeaff, #fbe9ee)",
        filter: "blur(0.5px)",
      }}
    />
  );
}

export default function HeroScene() {
  const { show3d, reduced } = useDeviceCapability();

  if (!show3d) return <StaticOrb />;

  return (
    <Suspense fallback={<StaticOrb />}>
      <Canvas
        dpr={[1, reduced ? 1.5 : 2]}
        camera={{ position: [0, 0, 4.4], fov: 42 }}
        gl={{ antialias: !reduced, alpha: true }}
      >
        <FaceOrb reduced={reduced} />
      </Canvas>
    </Suspense>
  );
}
