'use client';

import React from 'react';
import MaxWidthWrapper from './MaxWidthWrapper';
import Image from 'next/image';
import { Button } from './ui/button';
import Link from 'next/link';

const steps = [
  {
    number: 1,
    title: 'Create or Join a Group',
    description:
      'Sign up and either start a new group or join an existing one with your friends and family.',
    imageSrc: '/images/step1.png',
    altText: 'Person tapping "Create Group" on a smartphone',
    width: 800,  // Added width
    height: 800  // Added height
  },
  {
    number: 2,
    title: 'Customize Your Group',
    description:
      "Set the payout amounts, contribution frequency, and event duration to fit your group's preferences.",
    imageSrc: '/images/step2.png',
    altText: 'Settings dashboard with adjustable sliders',
  },
  {
    number: 3,
    title: 'Authenticate Members',
    description:
      'Invite members to join and complete secure authentication for trust and transparency.',
    imageSrc: '/images/step3.png',
    altText: 'Members accepting invites with ID verification icons',
  },
  {
    number: 4,
    title: 'Automated Transactions',
    description:
      "Roundly handles all billing and payouts through direct debit, so you don't have to worry about manual processes.",
    imageSrc: '/images/step4.png',
    altText: 'Money transferring between accounts automatically',
  },
  {
    number: 5,
    title: 'Track Progress',
    description:
      'Monitor contributions, payouts, and group activity with real-time graphs and reports.',
    imageSrc: '/images/step5.png',
    altText: 'Dashboard displaying charts and statistics',
  },
];

const HowItWorks = () => {
  return (
    <section className="py-24">
      <MaxWidthWrapper>
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Getting Started is <span className="text-yellow-400">Simple</span>
          </h2>
          <p className="mt-4 text-gray-600 text-lg">
            Follow these easy steps to begin your group savings journey.
          </p>
        </div>

        <div className="space-y-16">
          {steps.map((step) => (
            <div
              key={step.number}
              className={`flex flex-col lg:flex-row items-center gap-8 ${
                step.number % 2 === 0 ? 'lg:flex-row-reverse' : ''
              }`}
            >
              {/* Image Container */}
              <div className="flex-1 w-full">
                <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden">
                  {step.number === 1 ? (
                    // Special handling for step 1 image
                    <Image
                      src={step.imageSrc}
                      alt={step.altText}
                      width={step.width}
                      height={step.height}
                      className="object-contain w-full h-full rounded-2xl"
                      priority
                    />
                  ) : (
                    // Original handling for other images
                    <Image
                      src={step.imageSrc}
                      alt={step.altText}
                      fill
                      className="object-cover rounded-2xl"
                      priority
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="max-w-md mx-auto lg:mx-0 space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="text-4xl font-bold text-yellow-400">
                      {step.number}
                    </div>
                    <h3 className="text-2xl font-semibold text-gray-900">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-gray-600 text-lg leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <div className="text-center mt-16">
          <Button
            size="lg"
            className="bg-yellow-400 text-white hover:bg-yellow-500 transition-all"
            asChild
          >
            <Link href="/signup">Get Started with Roundly</Link>
          </Button>
        </div>
      </MaxWidthWrapper>
    </section>
  );
};

export default HowItWorks;