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
    imageSrc: '/images/step1.jpg',
    altText: 'Person tapping "Create Group" on a smartphone',
  },
  {
    number: 2,
    title: 'Customize Your Group',
    description:
      "Set the payout amounts, contribution frequency, and event duration to fit your group's preferences.",
    imageSrc: '/images/step2.jpg',
    altText: 'Settings dashboard with adjustable sliders',
  },
  {
    number: 3,
    title: 'Authenticate Members',
    description:
      'Invite members to join and complete secure authentication for trust and transparency.',
    imageSrc: '/images/step3.jpg',
    altText: 'Members accepting invites with ID verification icons',
  },
  {
    number: 4,
    title: 'Automated Transactions',
    description:
      "Roundly handles all billing and payouts through direct debit, so you don't have to worry about manual processes.",
    imageSrc: '/images/step4.jpg',
    altText: 'Money transferring between accounts automatically',
  },
  {
    number: 5,
    title: 'Track Progress',
    description:
      'Monitor contributions, payouts, and group activity with real-time graphs and reports.',
    imageSrc: '/images/step5.jpg',
    altText: 'Dashboard displaying charts and statistics',
  },
];

const HowItWorks = () => {
  return (
    <section className="py-24">
      <MaxWidthWrapper>
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Getting Started is <span className="text-purple-600">Simple</span>
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
                  <Image
                    src={step.imageSrc}
                    alt={step.altText}
                    fill
                    className="object-cover rounded-2xl"
                    priority
                    sizes="(max-width: 768px) 100vw, 50vw"
                    style={{
                      backgroundImage: `url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAAElBMVEUAAAD8/vz08vT09vT8+vzs7uxH16TeAAAAAXRSTlMAQObYZgAAAAlwSFlzAAAOxAAADsQBlSsOGwAAAuFJREFUOI0Vk+3NLiEIRG1B8ClAYAsQ2AIEt4D9ePtv5Xp/mZgYJ2fOFJKEfInkVWY2aglmQFkimRTV7MblYyVqD7HXyhKsSuPX12MeDhRHLtGvRG+P+B/S0Vu4OswR9tmvwNPyhdCDbVayJGads/WiUWcjCvCnruTBNHS9gmX2VzVbk7ZvB1gb1hkWFGl+A/n+/FowcO34U/XvKqZ/fHY+6vgRfU92XrOBUbGeeDfQmjWjdrK+frc6FdGReQhfSF5JvR29O2QrfNw1huTwlgsyXLo0u+5So82sgv7tsFZR2nxB6lXiquHrfD8nfYZ9SeT0LiuvSoVrxGY16pCNRZKqvwWsn5OHypPBELzohMCaRaa0ceTHYqe7X/gfJEEtKFbJpWoNqO+aS1cuTykGPpK5Ga48m6L3NefTr013KqYBQu929iP1oQ/7UwSR+i3zqruUmT84qmhzLpxyj7pr9kg7LKvqaXxZmdpn+6o8sHqSqojy02gU3U8q9PnpidiaLks0mbMYz+q2uVXsoBQ8bfURULYxRgZVYCHMv9F4OA7qxT2NPPpvGQ/sTDH2yznKh7E2AcErfcNsaIoN1izzbJiaY63x4QjUFdBSvDCvugPpu5xDny0jzEeuUQbcP1aGT9V90uixngTRLYNEIIZ6yOF1H8tm7rj2JxiefsVy53zGVy3ag5uuPsdufYOzYxLRxngKe7nhx3VAq54pmz/DK9/Q3aDam2Yt3hNXB4HuU87jKNd/CKZn77Qdn5QkXPfqSkhk7hGOXXB+7v09KbBbqdvxGqa0AqfK/atIrL2WXdAgXAJ43Wtwe/aIoacXezeGPMlhDOHDbSfHnaXsL2QzbT82GRwZuezdwcoWzx5pnOnGMUdHuiY7lhdyWzWiHnucLZQxYStMJbtcydHaQ6vtMbe0AcDbxG+QG14AL94xry4297xpy9Cpf1OoxZ740gHDfrK+gtsy0xabwJmfgtCeii79B6aj0SJeLbd7AAAAAElFTkSuQmCC)`,
                      backgroundSize: 'cover',
                      mixBlendMode: 'multiply',
                    }}
                  />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="max-w-md mx-auto lg:mx-0 space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="text-4xl font-bold text-purple-600">
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
            className="bg-purple-500 text-white hover:bg-purple-700 transition-all"
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