"use client";
import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

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
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-medium tracking-tight text-black dark:text-white mb-4"
          >
            How Payments Work on{" "}
            <span className="text-yellow-400">HivePay</span>
          </motion.h2>
          <p className="text-xl text-gray-600">
            Transparent and secure payment processing for your group contributions.
          </p>
        </div>

        {/* Carousel */}
        <div className="relative max-w-5xl mx-auto">
          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              {/* Background Glow */}
              <div className="relative w-80 h-80 mx-auto mb-8">
                <div className="absolute inset-0 bg-yellow-200 rounded-full blur-3xl opacity-30"></div>
                <div className="relative w-full h-full">
                  <Image
                    src={steps[currentStep].imageUrl}
                    alt={steps[currentStep].title}
                    fill
                    className="object-contain rounded-full shadow-lg"
                    sizes="(max-width: 768px) 100vw, 320px"
                    priority
                  />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">
                {steps[currentStep].title}
              </h3>
              <p className="text-lg text-gray-600">
                {steps[currentStep].description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-center items-center gap-4 mt-8">
            {/* Prev Button */}
            <button
              onClick={prevStep}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-full transition flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Step Indicators */}
            <div className="flex gap-2">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-3 h-3 rounded-full ${
                    index === currentStep
                      ? "bg-yellow-400"
                      : "bg-gray-300 hover:bg-gray-400"
                  }`}
                ></button>
              ))}
            </div>

            {/* Next Button */}
            <button
              onClick={nextStep}
              className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-white rounded-full transition flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PaymentFlow;