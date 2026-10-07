import { useEffect, useState } from "react";

function detectWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Coarse device-capability check used to gate the 3D hero (spec §4/§24/§27):
 * skip WebGL entirely without support or reduced-motion, and render fewer
 * particles / simpler geometry on small / low-core screens.
 */
export function useDeviceCapability() {
  const [state, setState] = useState(() => ({
    canWebgl: typeof window === "undefined" ? true : detectWebgl(),
    reducedMotion:
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    isSmallScreen: typeof window !== "undefined" && window.innerWidth < 768,
  }));

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onResize = () =>
      setState((s) => ({ ...s, isSmallScreen: window.innerWidth < 768 }));
    const onMotionChange = () =>
      setState((s) => ({ ...s, reducedMotion: mq.matches }));

    window.addEventListener("resize", onResize);
    mq.addEventListener?.("change", onMotionChange);
    return () => {
      window.removeEventListener("resize", onResize);
      mq.removeEventListener?.("change", onMotionChange);
    };
  }, []);

  const lowPower =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency <= 4
      : false;

  return {
    show3d: state.canWebgl && !state.reducedMotion,
    reduced: state.isSmallScreen || lowPower,
  };
}
