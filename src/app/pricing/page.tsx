"use client";

import { Check } from 'lucide-react';
import Link from 'next/link';
import MaxWidthWrapper from '@/src/components/MaxWidthWrapper';
import { motion } from 'framer-motion';
import { PLANS } from '@/src/config/stripe';
import { trpc } from '../_trpc/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/src/components/ui/use-toast';
import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";

const Page = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { user } = useKindeBrowserClient();

  const { mutate: createStripeSession } = trpc.subscription.createStripeSession.useMutation({
    onSuccess: ({ url }) => {
      if (url) {
        router.push(url);
      }
    },
    onError: (err) => {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again later.',
        variant: 'destructive',
        className: "fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[360px]",
      });
      setLoadingPlan(null);
    },
  });

  const handlePlanSelect = (plan: typeof PLANS[number]) => {
    if (!user) {
      router.push('/api/auth/login');
      return;
    }
    setLoadingPlan(plan.slug);
    createStripeSession({ planSlug: plan.slug });
  };

  // Filter to show only Pro plan
  const displayPlans = PLANS.filter(plan => plan.name === 'Pro');

  return (
    <>
      <div className="bg-white min-h-screen pb-20">
        <MaxWidthWrapper className='pt-12'>
          <div className='mb-4'>
            <span className='bg-yellow-50 text-yellow-400 px-3 py-1 rounded-md text-sm font-medium'>
              PREMIUM ACCESS
            </span>
          </div>
          
          <h1 className='text-6xl font-bold mb-4'>Unlock the Full Power of Group Savings</h1>
          <p className='text-gray-600 text-xl mb-16 max-w-3xl'>
            Transform your saving goals with our premium features. Designed for groups serious about 
            achieving their financial targets together.
          </p>

          <div className='max-w-2xl mx-auto'>
            {displayPlans.map((plan) => {
              const price = plan.price.amount;
              const isLoading = loadingPlan === plan.slug;

              return (
                <div key={plan.slug} className="relative">
                  <div className='absolute -top-4 left-0 right-0 flex justify-center items-center gap-3'>
                    <div className='h-px bg-yellow-400 flex-1'></div>
                    <span className='text-yellow-400 text-sm font-medium whitespace-nowrap'>
                      Premium Plan
                    </span>
                    <div className='h-px bg-yellow-400 flex-1'></div>
                  </div>
                  
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
                      className="w-full py-2.5 px-4 rounded-md text-sm font-medium transition-colors duration-200 bg-yellow-400 text-white hover:bg-yellow-500"
                      onClick={() => handlePlanSelect(plan)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Processing...</span>
                        </div>
                      ) : (
                        'Get Premium Access'
                      )}
                    </motion.button>

                    <ul className='mt-8 space-y-4'>
                      {plan.features.map((feature) => (
                        <li key={feature} className='flex items-start gap-3'>
                          <Check className='h-4 w-4 text-yellow-400 mt-1 flex-shrink-0' />
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