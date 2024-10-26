'use client';

import React from 'react';
import MaxWidthWrapper from './MaxWidthWrapper';
import { motion } from 'framer-motion';
import { Banknote, Receipt, Users, Settings, Shield, BarChart, 
} from 'lucide-react';

const features = [
  {
    title: 'Direct Debit Integration',
    description:
      'Simplify contributions with automatic direct debit payments from all members.',
    icon: Banknote,
  },
  {
    title: 'Receipt Generation',
    description:
      'Automatically receive digital receipts for all transactions for your records.',
    icon: Receipt,
  },
  {
    title: 'Member Visibility',
    description:
      "View profiles of all group members to know who you're saving with.",
    icon: Users,
  },
  {
    title: 'Customizable Settings',
    description:
      "Adjust contribution amounts, schedules, and payout order to suit your group's needs.",
    icon: Settings,
  },
  {
    title: 'Security Measures',
    description:
      'Benefit from data encryption, two-factor authentication, and compliance with financial regulations.',
    icon: Shield,
  },
  {
    title: 'Insightful Analytics',
    description:
      'Access detailed graphs and data to track contributions, payouts, and group performance.',
    icon: BarChart,
  },
  
];

const FeaturesSpotlight = () => {
  return (
    <section className="py-24 ">
      <MaxWidthWrapper>
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Powerful Features Designed for{' '}
            <span className="text-purple-600">Seamless Savings</span>
          </h2>
          <p className="mt-4 text-gray-600 text-lg">
            Explore the tools that make Roundly the best choice for group savings.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300"
                whileHover={{ scale: 1.05 }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                {/* Icon */}
                <div className="flex items-center mb-4">
                  <div className="p-4 bg-purple-100 rounded-full">
                    <Icon className="w-8 h-8 text-purple-600" />
                  </div>
                </div>
                {/* Feature Title */}
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                {/* Feature Description */}
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </MaxWidthWrapper>
    </section>
  );
};

export default FeaturesSpotlight;
