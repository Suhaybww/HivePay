/* eslint-disable react/no-unescaped-entities */
import MaxWidthWrapper from '../components/MaxWidthWrapper';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { buttonVariants } from '../components/ui/button';
import Introduction from '../components/Introduction';
import KeyBenefits from '../components/KeyBenefits'; 
import HowItWorks from '../components/HowItWorks';
import FeaturesSpotlight from '../components/FeaturesSpotlight';

// Home component
const Home = async () => {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes typing {
          from { width: 0 }
          to { width: 100% }
        }

        @keyframes blink {
          from { border-color: #9089fc }
          to { border-color: transparent }
        }

        .typing-effect {
          display: inline-block;
          overflow: hidden;
          white-space: nowrap;
          border-right: 3px solid #9089fc;
          animation: 
            typing 3.5s steps(30, end) forwards,
            blink 0.75s step-end forwards;
          width: 100%;
        }
      `}} />

      {/* Grainy Background for the Entire Page */}
      <div className="grainy min-h-screen">
        {/* Hero Section */}
        <div>
          <div className="relative isolate">
            {/* Background Decoration */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
            >
              <div
                style={{
                  clipPath:
                    'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
                }}
                className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
              />
            </div>

            {/* Landing Page Section */}
            <section className="px-2 pt-32 md:px-0">
              <div className="container items-center max-w-6xl px-5 mx-auto space-y-6 text-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-left text-gray-900 sm:text-5xl md:text-6xl md:text-center">
                  <span className="block typing-effect">
                    Simplify Your{' '}
                    <span
                      className="block mt-1 text-purple-500 lg:inline lg:mt-0"
                      data-primary="purple-500"
                    >
                      Group Savings
                    </span>
                  </span>
                </h1>
                <p className="w-full mx-auto text-base text-left text-gray-500 md:max-w-md sm:text-lg lg:text-2xl md:max-w-3xl md:text-center">
                  Join Roundly, a digital platform for secure and automated rotating savings. Whether saving with friends or family, our system ensures trust and transparency every step of the way.
                </p>
                <div className="relative flex flex-col justify-center md:flex-row md:space-x-4">
                  {/* Add any call-to-action buttons here if needed */}
                </div>
              </div>
              <div className="container items-center max-w-4xl px-5 mx-auto mt-16 text-center">
                <img
                  src="https://cdn.devdojo.com/images/november2020/hero-image.png"
                  alt="Hero"
                />
              </div>
            </section>
          </div>
        </div>

        {/* Section 2: Introduction */}
        <Introduction />

        {/* Section 3: Key Benefits */}
        <KeyBenefits />

        {/* Section 4: How It Works */}
        <HowItWorks />

        {/* Section 5: Features Spotlight */}
        <FeaturesSpotlight />

      </div>
    </>
  );
};

export default Home;
