import "@/landing-v2.css";
import { Navbar } from "@/components/landing-v2/Navbar";
import { Hero } from "@/components/landing-v2/Hero";
import { Features } from "@/components/landing-v2/Features";
import { LivePreview } from "@/components/landing-v2/LivePreview";
import { Testimonials } from "@/components/landing-v2/Testimonials";
import { CTA } from "@/components/landing-v2/CTA";
import { Footer } from "@/components/landing-v2/Footer";

const LandingV2 = () => {
  return (
    <div className="landing-v2 min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Features />
      <LivePreview />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  );
};

export default LandingV2;
