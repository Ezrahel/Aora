import { LandingThemeProvider } from "./landing/LandingTheme";
import Navbar from "./landing/Navbar";
import Hero from "./landing/Hero";
import Problem from "./landing/Problem";
import Features from "./landing/Features";
import BYOKSection from "./landing/BYOKSection";
import PricingEngine from "./landing/PricingEngine";
import UsageMetering from "./landing/UsageMetering";
import Entitlements from "./landing/Entitlements";
import RevenueDashboard from "./landing/RevenueDashboard";
import DevConsole from "./landing/DevConsole";
import ComparisonTable from "./landing/ComparisonTable";
import Testimonials from "./landing/Testimonials";
import AIBillingAssistant from "./landing/AIBillingAssistant";
import CTASection from "./landing/CTASection";
import Footer from "./landing/Footer";

interface LandingPageViewProps {
  onNavigateTab: (tab: string) => void;
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

export default function LandingPageView({ onNavigateTab }: LandingPageViewProps) {
  return (
    <LandingThemeProvider>
      <Navbar onNavigateTab={onNavigateTab} scrollToId={scrollToId} />
      <Hero onNavigateTab={onNavigateTab} />
      <Problem />
      <Features />
      <BYOKSection />
      <PricingEngine />
      <UsageMetering />
      <Entitlements />
      <RevenueDashboard />
      <AIBillingAssistant />
      <DevConsole />
      <ComparisonTable />
      <Testimonials />
      <CTASection onNavigateTab={onNavigateTab} />
      <Footer onNavigateTab={onNavigateTab} scrollToId={scrollToId} />
    </LandingThemeProvider>
  );
}
