import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, Camera, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CameraScan from "./scan/CameraScan";
import ModelAvailability from "@/components/ModelAvailability";
import { SAFETY_DISCLAIMER } from "@/content/safety";

type Step = "choose" | "camera" | "truedepth";

export default function ScanPage() {
  const [step, setStep] = useState<Step>(import.meta.env.DEV && window.location.search.includes("demo") ? "camera" : "choose");

  return (
    <>
      <Navbar />
      <main className="section" style={{ minHeight: "75vh" }}>
        <div className="container" style={{ maxWidth: 940 }}>
          <AnimatePresence mode="wait">
            {step === "choose" && <ChooseStep key="choose" onSelect={setStep} />}
            {step === "camera" && <CameraScan key="camera" onBack={() => setStep("choose")} />}
            {step === "truedepth" && <TrueDepthStep key="truedepth" onBack={() => setStep("choose")} />}
          </AnimatePresence>
          <ModelAvailability />
        </div>
      </main>
      <Footer />
    </>
  );
}

function ChooseStep({ onSelect }: { onSelect: (step: Step) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4 }}
    >
      <div className="section-head">
        <span className="eyebrow">Step 1 of 3</span>
        <h1 style={{ fontSize: "clamp(30px, 4vw, 44px)" }}>Choose your scan</h1>
        <p className="lede">Pick the capture method available on your device.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <button
          onClick={() => onSelect("truedepth")}
          className="card text-left p-8 transition-transform hover:-translate-y-1"
          style={{ boxShadow: "var(--shadow-tight)" }}
        >
          <span
            className="inline-flex items-center justify-center rounded-2xl mb-6"
            style={{ width: 56, height: 56, background: "var(--rose-soft)", color: "var(--rose-deep)" }}
          >
            <Smartphone size={26} strokeWidth={1.8} />
          </span>
          <h3 className="mb-2">iPhone TrueDepth</h3>
          <p>Advanced 3D scan using Apple's depth-sensing camera. Requires the Smart Skin Care iOS app.</p>
        </button>

        <button
          onClick={() => onSelect("camera")}
          className="card text-left p-8 transition-transform hover:-translate-y-1"
          style={{ boxShadow: "var(--shadow-tight)" }}
        >
          <span
            className="inline-flex items-center justify-center rounded-2xl mb-6"
            style={{ width: 56, height: 56, background: "var(--lilac-soft)", color: "#b5647f" }}
          >
            <Camera size={26} strokeWidth={1.8} />
          </span>
          <h3 className="mb-2">Camera scan</h3>
          <p>Compatible with any laptop, desktop, or Android device with a front-facing camera.</p>
        </button>
      </div>

      <p className="text-center mt-10" style={{ fontSize: 13, color: "var(--ink-faint)" }}>
        {SAFETY_DISCLAIMER}
      </p>
    </motion.div>
  );
}

function TrueDepthStep({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4 }}
      className="text-center"
      style={{ maxWidth: 480, margin: "0 auto" }}
    >
      <span
        className="inline-flex items-center justify-center rounded-2xl mb-6"
        style={{ width: 56, height: 56, background: "var(--rose-soft)", color: "var(--rose-deep)", margin: "0 auto 24px" }}
      >
        <Smartphone size={26} strokeWidth={1.8} />
      </span>
      <h2 style={{ fontSize: 28, marginBottom: 12 }}>TrueDepth needs the native app</h2>
      <p className="lede" style={{ marginBottom: 32 }}>
        The native iOS project includes camera and TrueDepth capture. It still needs
        an Xcode build and verification on a compatible iPhone before distribution.
        In this browser, use camera scan to access the same analysis service.
      </p>
      <button onClick={onBack} className="btn btn-ghost">
        <ArrowLeft size={16} /> Choose a different mode
      </button>
    </motion.div>
  );
}
