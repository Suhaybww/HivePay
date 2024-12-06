"use client";

import React, { useState } from "react";

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

  const nextStep = () =>
    setCurrentStep((prev) => (prev + 1) % steps.length);
  const prevStep = () =>
    setCurrentStep((prev) =>
      prev === 0 ? steps.length - 1 : prev - 1
    );

  return (
    <section className="w-full bg-white py-24">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-black dark:text-white mb-4">
        How Payments Work on{" "}
            <span className="text-yellow-500">HivePay</span>
          </h2>
          <p className="text-xl text-gray-600">
            Transparent and secure payment processing for your group contributions.
          </p>
        </div>

        {/* Carousel */}
        <div className="relative max-w-5xl mx-auto">
          {/* Step Content */}
          <div className="text-center">
            <div className="relative w-80 h-80 mx-auto mb-8">
              {/* Background Glow */}
              <div className="absolute inset-0 bg-yellow-200 rounded-full blur-3xl opacity-30"></div>

              {/* Image */}
              <img
                src={steps[currentStep].imageUrl}
                alt={steps[currentStep].title}
                className="relative w-full h-full object-contain rounded-full shadow-lg"
              />
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              {steps[currentStep].title}
            </h3>
            <p className="text-lg text-gray-600">{steps[currentStep].description}</p>
          </div>

          {/* Navigation */}
          <div className="flex justify-center items-center gap-4 mt-8">
            <button
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-full transition"
              onClick={prevStep}
            >
              Prev
            </button>
            <div className="flex gap-2">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full ${
                    index === currentStep
                      ? "bg-yellow-500"
                      : "bg-gray-300"
                  }`}
                ></div>
              ))}
            </div>
            <button
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full transition"
              onClick={nextStep}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PaymentFlow;
