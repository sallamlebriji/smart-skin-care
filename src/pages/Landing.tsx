import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ScanPreview from "@/components/ScanPreview";
import FaceScanSection from "@/components/FaceScanSection";
import SkinInsights from "@/components/SkinInsights";
import CaptureShowcase from "@/components/CaptureShowcase";
import Pillars from "@/components/Pillars";
import IngredientSafety from "@/components/IngredientSafety";
import IngredientScanShowcase from "@/components/IngredientScanShowcase";
import ChatDemo from "@/components/ChatDemo";
import Experts from "@/components/Experts";
import Testimonials from "@/components/Testimonials";
import Faq from "@/components/Faq";
import CtaBanner from "@/components/CtaBanner";
import Footer from "@/components/Footer";

export default function Landing() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ScanPreview />
        <FaceScanSection />
        <SkinInsights />
        <CaptureShowcase />
        <Pillars />
        <IngredientSafety />
        <IngredientScanShowcase />
        <ChatDemo />
        <Experts />
        <Testimonials />
        <Faq />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
