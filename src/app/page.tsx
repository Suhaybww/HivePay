/* eslint-disable react/no-unescaped-entities */
import MaxWidthWrapper from '../components/MaxWidthWrapper';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { buttonVariants } from '../components/ui/button';
import Hero from '../components/Hero';
import Introduction from '../components/Introduction';
import HowItWorks from '../components/HowItWorks';
import FeaturesSpotlight from '../components/FeaturesSpotlight';
import FinalCTA from '../components/FinalCTA';
import Footer from '../components/Footer';

const Home = async () => {
  return (
    <div className="grainy min-h-screen">
      {/* Hero Section */}
      <Hero />

      {/* Section 2: Introduction */}
      <Introduction />

      {/* Section 4: How It Works */}
      <HowItWorks />

      {/* Section 5: Features Spotlight */}
      <FeaturesSpotlight />

      {/* Section 6: Final Call-to-Action */}
      <FinalCTA />

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Home;