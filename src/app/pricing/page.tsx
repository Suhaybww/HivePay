"use client";

import { Check } from 'lucide-react';
import Link from 'next/link';
import MaxWidthWrapper from '@/src/components/MaxWidthWrapper';
import { motion } from 'framer-motion';
import { PLANS } from '@/src/config/stripe';

const Page = () => {
  return (
    <>
      <div className="grainy min-h-screen pb-20">
        <MaxWidthWrapper className='pt-12'>
          <div className='mb-4'>
            <span className='bg-purple-50 text-purple-600 px-3 py-1 rounded-md text-sm font-medium'>
              PRICING
            </span>
          </div>
          
          <h1 className='text-6xl font-bold mb-4'>Choose your savings journey</h1>
          <p className='text-gray-600 text-xl mb-16 max-w-3xl'>
            Select a plan that matches your group&apos;s ambitions. From casual saving circles to 
            large organizations, we&apos;ve got you covered.
          </p>

          <div className='grid md:grid-cols-2 gap-8 max-w-4xl mx-auto'>
            {PLANS.map((plan) => {
              const price = plan.price.amount;
              const isPopular = plan.name === 'Pro';
              const isFree = plan.name === 'Free';

              return (
                <div key={plan.slug} className="relative">
                  {isPopular ? (
                    <div className='absolute -top-4 left-0 right-0 flex justify-center items-center gap-3'>
                      <div className='h-px bg-purple-600 flex-1'></div>
                      <span className='text-purple-600 text-sm font-medium whitespace-nowrap'>
                        Most popular
                      </span>
                      <div className='h-px bg-purple-600 flex-1'></div>
                    </div>
                  ) : (
                    <div className='absolute -top-4 left-0 right-0 flex justify-center items-center gap-3'>
                      <div className='h-px bg-gray-200 flex-1'></div>
                      <span className='text-gray-400 text-sm font-medium whitespace-nowrap'>
                        Basic
                      </span>
                      <div className='h-px bg-gray-200 flex-1'></div>
                    </div>
                  )}
                  
                  <div className='p-8'>
                    <h3 className='text-2xl font-semibold mb-6'>{plan.name}</h3>
                    <div className='flex items-baseline gap-1 mb-4'>
                      <span className='text-6xl font-bold'>${price}</span>
                      <span className='text-gray-500 ml-1'>per month</span>
                    </div>
                    <p className='text-gray-600 mb-8'>{plan.description}</p>
                    
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`w-full py-2.5 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${
                        isPopular
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'hover:bg-purple-50 border border-gray-200'
                      }`}
                    >
                      Get started
                    </motion.button>

                    <ul className='mt-8 space-y-4'>
                      {plan.features.map((feature) => (
                        <li key={feature} className='flex items-start gap-3'>
                          <Check className='h-4 w-4 text-purple-600 mt-1 flex-shrink-0' />
                          <span className='text-gray-600 text-sm'>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </MaxWidthWrapper>
      </div>
    </>
  );
};

export default Page;