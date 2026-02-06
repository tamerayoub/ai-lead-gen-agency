import "@/landing-v3.css";
import { Navbar } from "@/components/landing-v3/Navbar";
import { HeroSection } from "@/components/landing-v3/HeroSection";
import { IntegrationFlow } from "@/components/landing-v3/IntegrationFlow";
import { FeaturesSection } from "@/components/landing-v3/FeaturesSection";
import { CTASection } from "@/components/landing-v3/CTASection";
import { Footer } from "@/components/landing-v3/Footer";

const LandingV3 = () => {
  return (
    <div className="landing-v3 min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <IntegrationFlow />
      <FeaturesSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default LandingV3;
