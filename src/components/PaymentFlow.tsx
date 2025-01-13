"use client";

import React, { useState } from "react";
import Image from "next/image";
import MaxWidthWrapper from "./MaxWidthWrapper"; 

const PaymentFlow: React.FC = () => {
  const steps = [
    {
      title: "Cycle Initiation",
      description:
        "The group admin starts the contribution cycle, and direct debits are scheduled for the next contribution date.",
      imageUrl: "/images/start.png",
    },
    {
      title: "Funds Collection",
      description:
        "Contributions are direct debited from all members and securely held in Stripe's platform until validated.",
      imageUrl: "/images/collect.png",
    },
    {
      title: "Payout Distribution",
      description:
        "After all contributions are confirmed, the total payout is sent to the next person in line via Stripe Connect.",
      imageUrl: "/images/payout.png",
    },
    {
      title: "Repeat for All Members",
      description:
        "The cycle repeats on the next contribution date until all members receive their payouts.",
      imageUrl: "/images/repeat.png",
    },
  ];

  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => setCurrentStep((prev) => (prev + 1) % steps.length);
  const prevStep = () =>
    setCurrentStep((prev) => (prev === 0 ? steps.length - 1 : prev - 1));

  return (
    <section className="w-full py-16">
      {/* Wrap content with MaxWidthWrapper */}
      <MaxWidthWrapper>
        {/* Heading */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-800 mb-4">
            How Payments Work on{" "}
            <span className="text-yellow-400">HivePay</span>
          </h2>
          <p className="text-lg text-gray-500">
            Transparent and secure payment processing for your group contributions.
          </p>
        </div>

        {/* Steps & Content */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-16 items-start md:items-center">
          {/* Step-by-Step Progress */}
          <div className="flex md:flex-col items-center md:items-start gap-4">
            {steps.map((step, index) => (
              <div
                key={index}
                className="flex items-center gap-3 md:gap-4 text-sm md:text-base"
              >
                <div
                  className={`w-8 h-8 flex items-center justify-center rounded-full border-2 font-bold transition-colors ${
                    index === currentStep
                      ? "bg-yellow-400 border-yellow-500 text-white"
                      : "border-gray-300 text-gray-500"
                  }`}
                >
                  {index + 1}
                </div>
                <div
                  className={`hidden md:block font-medium ${
                    index === currentStep ? "text-yellow-500" : "text-gray-500"
                  }`}
                >
                  {step.title}
                </div>
              </div>
            ))}
          </div>

          {/* Main Step Content (No card, no gray bg) */}
          <div className="flex-1 p-0 md:p-0 relative">
            <div className="flex flex-col lg:flex-row gap-8 lg:items-center">
              {/* Image Section */}
              <div className="relative w-full h-64 lg:h-80 lg:w-1/2 mx-auto">
                <Image
                  src={steps[currentStep].imageUrl}
                  alt={steps[currentStep].title}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              </div>

              {/* Text Section */}
              <div className="lg:w-1/2 mt-4 lg:mt-0">
                <h3 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                  {steps[currentStep].title}
                </h3>
                <p className="text-gray-600 text-base md:text-lg leading-relaxed">
                  {steps[currentStep].description}
                </p>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-start md:justify-end gap-4 mt-8">
              <button
                onClick={prevStep}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={nextStep}
                className="px-4 py-2 bg-yellow-400 text-white rounded-md hover:bg-yellow-500 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dots Navigation */}
        <div className="flex md:hidden justify-center gap-2 mt-6">
          {steps.map((_, index) => (
            <div
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-3 h-3 rounded-full cursor-pointer ${
                index === currentStep ? "bg-yellow-500" : "bg-gray-300"
              }`}
            ></div>
          ))}
        </div>
      </MaxWidthWrapper>
    </section>
  );
};

export default PaymentFlow;
