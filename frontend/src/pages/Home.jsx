import CtaBand from "@/components/landing/CtaBand";
import Faq from "@/components/landing/Faq";
import Footer from "@/components/landing/Footer";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import MarketsTable from "@/components/landing/MarketsTable";
import Navbar from "@/components/landing/Navbar";
import TickerTape from "@/components/landing/TickerTape";
import SeamlessAccess from "@/components/landing/SeamlessAccess";
import WhyOrbit from "@/components/landing/WhyOrbit";
import { useOrbitPrices } from "@/hooks/useOrbitPrices";

export default function Home() {
  const { data: tickers, status } = useOrbitPrices();
  const btc = tickers.BTCUSDT;

  // Ranked by live volume, the same way the markets list ranks itself. The
  // tape shows every market Orbit carries rather than a chosen few — its job
  // is to be evidence, and a curated tape is not evidence.
  const taped = Object.entries(tickers)
    .sort(([, a], [, b]) => (b.quoteVolume ?? 0) - (a.quoteVolume ?? 0))
    .map(([symbol]) => symbol);

  return (
    <div className="page min-h-screen bg-void">
      <Navbar />
      <Hero tickers={tickers} status={status} />
      <TickerTape symbols={taped} tickers={tickers} />
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
