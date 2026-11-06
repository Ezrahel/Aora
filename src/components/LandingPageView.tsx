import { LandingThemeProvider, useLandingTheme } from "./landing/LandingTheme";
import SceneLayer from "./landing/scene/SceneLayer";
import MeterHud from "./landing/ui/MeterHud";
import Navbar from "./landing/Navbar";
import Hero from "./landing/Hero";
import Problem from "./landing/Problem";
import Pipeline from "./landing/Pipeline";
import PricingEditor from "./landing/PricingEditor";
import BYOKSection from "./landing/BYOKSection";
import Features from "./landing/Features";
import AIBillingAssistant from "./landing/AIBillingAssistant";
import DevConsole from "./landing/DevConsole";
import ComparisonTable from "./landing/ComparisonTable";
import Testimonials from "./landing/Testimonials";
import CTASection from "./landing/CTASection";
import Footer from "./landing/Footer";

interface LandingPageViewProps {
  onNavigateTab: (tab: string) => void;
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

function Backdrop() {
  const { theme } = useLandingTheme();
  return (
    <>
      <SceneLayer theme={theme} />
      <div className="lp-blueprint" aria-hidden="true" />
    </>
  );
}

export default function LandingPageView({ onNavigateTab }: LandingPageViewProps) {
  return (
    <LandingThemeProvider>
      <Backdrop />
      <Navbar onNavigateTab={onNavigateTab} scrollToId={scrollToId} />
      <main>
        <Hero onNavigateTab={onNavigateTab} />
        <Problem />
        <Pipeline />
        <PricingEditor />
        <BYOKSection />
        <Features />
        <AIBillingAssistant />
        <DevConsole />
        <ComparisonTable />
        <Testimonials />
        <CTASection onNavigateTab={onNavigateTab} />
      </main>
      <Footer onNavigateTab={onNavigateTab} scrollToId={scrollToId} />
      <MeterHud />
    </LandingThemeProvider>
  );
}
