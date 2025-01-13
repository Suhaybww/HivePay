
import React from "react";
import Image from "next/image";

const Hero = () => {
  return (
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
                "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            }}
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#facc15] to-[#fbbf24] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          />
        </div>

        {/* Hero Content */}
        <section className="px-2 pt-32 md:px-0">
          <div className="container items-center max-w-6xl px-5 mx-auto space-y-6 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-left text-gray-900 sm:text-5xl md:text-6xl md:text-center">
              Simplify Your{" "}
              <span className="block mt-1 text-yellow-400 lg:inline lg:mt-0">
                Group Savings
              </span>
            </h1>
            <p className="w-full mx-auto text-base text-left text-gray-500 md:max-w-md sm:text-lg lg:text-2xl md:max-w-3xl md:text-center">
              Experience <strong className="text-yellow-400">0% Interest Free Loans</strong> with HivePay, 
              a platform for secure and automated rotating savings. Save with friends or family 
              to achieve your financial goals—no extra fees or interest, just trust and transparency.
            </p>
            <div className="relative flex flex-col justify-center md:flex-row md:space-x-4">
              {/* Call-to-action buttons could go here */}
            </div>
          </div>
          <div className="container items-center max-w-4xl px-5 mx-auto mt-16 text-center">
            <div className="relative w-full aspect-[16/9]">
              <Image
                src="/images/hero.png"
                alt="HivePay Introduction"
                fill
                priority
                className="object-contain"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Hero;
