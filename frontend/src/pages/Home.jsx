import CtaBand from "@/components/landing/CtaBand";
import Faq from "@/components/landing/Faq";
import Footer from "@/components/landing/Footer";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import MarketsTable from "@/components/landing/MarketsTable";
import Navbar from "@/components/landing/Navbar";
import SeamlessAccess from "@/components/landing/SeamlessAccess";
import WhyOrbit from "@/components/landing/WhyOrbit";
import { useOrbitPrices } from "@/hooks/useOrbitPrices";

export default function Home() {
  const { data: tickers, status } = useOrbitPrices();
  const btc = tickers.BTCUSDT;

  return (
    <div className="page min-h-screen bg-ink">
      <Navbar />
      <Hero tickers={tickers} status={status} />
      <MarketsTable tickers={tickers} />
      <HowItWorks />
      <WhyOrbit ticker={btc} />
      <SeamlessAccess ticker={btc} />
      <Faq />
      <CtaBand />
      <Footer />
    </div>
  );
}
