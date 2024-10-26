import React from 'react';
import MaxWidthWrapper from './MaxWidthWrapper';
import { CalendarCheck, PiggyBank, ShieldCheck, Users, BarChart, HeartHandshake } from 'lucide-react';

const benefits = [
  {
    title: 'Automated Billing',
    description:
      'Say goodbye to manual collections. Roundly uses direct debit to automate contributions, ensuring timely payments without the hassle.',
    icon: CalendarCheck,
  },
  {
    title: 'Transparent Transactions',
    description:
      'Keep everyone on the same page with real-time access to payment histories, payouts, and group activity.',
    icon: PiggyBank,
  },
  {
    title: 'Secure & Trustworthy',
    description:
      'User authentication and verification build trust within your group, giving you peace of mind.',
    icon: ShieldCheck,
  },
  {
    title: 'Easy Group Management',
    description:
      'Create and customize your groups with flexible settings to suit your collective needs.',
    icon: Users,
  },
  {
    title: 'Insightful Analytics',
    description:
      'Access detailed graphs and data to track contributions, payouts, and group performance.',
    icon: BarChart,
  },
  {
    title: 'Strengthened Community Bonds',
    description:
      'Roundly fosters a sense of community by bringing people together in a shared financial goal, making savings a more collaborative and engaging experience.',
    icon: HeartHandshake,
  },
];

const KeyBenefits = () => {
  return (
    <section className="py-24">
      <MaxWidthWrapper>
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Why Choose <span className="text-purple-600">Roundly</span>?
          </h2>
        </div>
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div key={index} className="flex flex-col items-center text-center">
                <div className="mb-4 p-4 bg-purple-100 rounded-full">
                  <Icon className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </div>
            );
          })}
        </div>
      </MaxWidthWrapper>
    </section>
  );
};

export default KeyBenefits;
