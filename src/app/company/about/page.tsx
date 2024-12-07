'use client';

import React from 'react';
import MaxWidthWrapper from '@/src/components/MaxWidthWrapper';
import { RegisterLink } from "@kinde-oss/kinde-auth-nextjs/components";

const AboutPage: React.FC = () => {
  return (
    <section className="bg-white text-gray-900 font-sans overflow-hidden">
      {/* HERO SECTION */}
      <div className="relative py-24 px-6 bg-white">
        <MaxWidthWrapper>
          <div className="text-center">
            <h1 className="text-5xl font-extrabold tracking-tight mb-8 leading-tight">
              About <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-yellow-600">HivePay</span>
            </h1>
            <p className="text-xl text-gray-700 max-w-2xl mx-auto">
              Redefining the way communities come together to save, invest, and grow—simplifying group finance for everyone.
            </p>
          </div>
        </MaxWidthWrapper>
      </div>

      {/* MISSION & VISION */}
      <div className="py-20 bg-white">
        <MaxWidthWrapper>
          <div className="flex flex-col lg:flex-row items-start gap-16">
            <div className="lg:w-1/2 space-y-8">
              <h2 className="text-3xl font-semibold">Our Mission</h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                At HivePay, our mission is to transform traditional saving circles into a modern, digital experience—accessible, intuitive, and secure. We’re dedicated to enabling communities to build trust, share resources, and achieve financial goals together.
              </p>
            </div>
            <div className="lg:w-1/2 space-y-8">
              <h2 className="text-3xl font-semibold">Our Vision</h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                We envision a future where financial barriers are broken down by cooperation, technology, and transparency. Our platform paves the way for a world where collective wealth-building is the norm, driving long-term prosperity for everyone involved.
              </p>
            </div>
          </div>
        </MaxWidthWrapper>
      </div>

      {/* OUR STORY */}
      <div className="relative bg-white border-t border-gray-200 py-20">
        <MaxWidthWrapper>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h2 className="text-4xl font-semibold">Our Story</h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                HivePay was founded on the belief that the power of community can transform personal finance. Inspired by the age-old practice of rotating savings and credit associations (ROSCAs), we saw an opportunity to blend tradition with innovation.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                By digitizing and simplifying these group saving methods, HivePay bridges the gap between the grassroots trust of local communities and the expansive reach of modern technology. Every feature we build is a step toward financial inclusivity, shared growth, and collective well-being.
              </p>
            </div>
            <div className="flex justify-center lg:justify-end">
              <img
                src="/images/about.png"
                alt="HivePay Community"
                className="w-full max-w-md"
              />
            </div>
          </div>
        </MaxWidthWrapper>
      </div>

      {/* CTA SECTION */}
      <div className="py-20 bg-white text-center">
        <MaxWidthWrapper>
          <div>
            <h2 className="text-3xl sm:text-4xl font-semibold mb-6">
              Ready to Start Saving as a Community?
            </h2>
            <p className="text-lg text-gray-700 mb-8">
              Join a movement that’s reshaping the future of finance. Come together, build trust, and achieve your financial dreams—together.
            </p>
            <RegisterLink
              className="inline-block bg-yellow-400 hover:bg-yellow-500 text-white text-lg font-medium px-8 py-3 rounded-md shadow transition-colors"
            >
              Get Started
            </RegisterLink>
          </div>
        </MaxWidthWrapper>
      </div>
    </section>
  );
};

export default AboutPage;
