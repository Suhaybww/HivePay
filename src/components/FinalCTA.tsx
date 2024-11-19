"use client";

import React from "react";
import { RegisterLink } from "@kinde-oss/kinde-auth-nextjs/components";

interface CTAProps {
  className?: string;
}

const CTASection: React.FC<CTAProps> = ({ className }) => {
  return (
    <div className={`relative w-full max-w-7xl mx-auto px-6 py-24 overflow-hidden ${className}`}>
      {/* Grid Pattern Overlay with Fade Effect */}
      <div className="absolute inset-0 bg-white dark:bg-black">
        <div 
          className="absolute inset-0 bg-[linear-gradient(to_right,#80808020_1px,transparent_1px),linear-gradient(to_bottom,#80808020_1px,transparent_1px)] bg-[size:24px_24px]"
          style={{
            mask: 'radial-gradient(circle at center, black, transparent 80%)',
            WebkitMask: 'radial-gradient(circle at center, black, transparent 80%)'
          }}
        />
      </div>
      
      {/* Content Container */}
      <div className="relative">
        <div className="flex flex-col items-center justify-center text-center">
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-black dark:text-white mb-4">
            Start Your Journey with HivePay
          </h2>
          
          <p className="text-base md:text-lg text-neutral-600 dark:text-neutral-300 max-w-2xl mb-8">
            Discover the easiest way to save together. Whether you're looking to create
            your first savings circle or explore our pricing plans, HivePay is
            here to help.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <RegisterLink className="px-6 py-3 text-lg font-medium text-white bg-yellow-400 hover:bg-yellow-500 rounded-md transition-colors">
              Create an Account
            </RegisterLink>
            
            <button
              className="px-6 py-3 text-lg font-medium text-yellow-400 bg-transparent border border-yellow-500 hover:bg-yellow-100 rounded-md transition-colors"
              onClick={() => (window.location.href = "/pricing")}
            >
              View Pricing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CTASection;