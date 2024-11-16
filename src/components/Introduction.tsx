import React from 'react';
import MaxWidthWrapper from './MaxWidthWrapper';
import Link from 'next/link';
import { Button } from './ui/button';
import Image from 'next/image';

const Introduction = () => {
  return (
    <section className="py-48">
      <MaxWidthWrapper>
        
        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* Content */}
          <div className="flex-1 space-y-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Modern Group Savings
              <span className="block mt-2 text-yellow-400">Made Simple</span>
            </h2>

            <p className="text-gray-600 text-lg leading-relaxed">
              HivePay reinvents the traditional ROSCA (Rotating Savings and Credit Association) 
              with a seamless, digital platform. Enjoy an internet-free, peer-to-peer loan system, 
              allowing you to save and lend with your trusted circle, 
              without banks or intermediaries. Perfect for achieving financial goals together.
            </p>

            <Button
              size="lg"
              className="mt-2 bg-yellow-400 text-white hover:bg-yellow-500 transition-all"
              asChild
            >
              <Link href="/how-it-works">
                Create an Account
              </Link>
            </Button>
          </div>

          {/* Image */}
          <div className="flex-1">
            <div className="relative w-full h-0 pb-[52.63%] overflow-hidden rounded-2xl">
              <Image
                src="/images/intro.png"
                alt="People managing their group savings"
                fill
                className="object-cover rounded-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </MaxWidthWrapper>
    </section>
  );
};

export default Introduction;
