"use client";

import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { CalendarClock, Receipt, Shield, BarChart, Users, LineChart, Clock } from "lucide-react";
import { cn } from "../lib/utils";
import createGlobe from "cobe";
import MaxWidthWrapper from "./MaxWidthWrapper";

const FeatureCard = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("p-4 sm:p-8 relative overflow-hidden", className)}>
      {children}
    </div>
  );
};

const FeatureTitle = ({ children, icon }: { children?: React.ReactNode; icon?: React.ReactNode }) => {
  return (
    <div className="flex items-center gap-3 mb-2">
      {icon && <div className="text-yellow-400 dark:text-yellow-500">{icon}</div>}
      <h3 className="text-xl md:text-2xl font-semibold text-left tracking-tight text-black dark:text-white">
        {children}
      </h3>
    </div>
  );
};

const FeatureDescription = ({ children }: { children?: React.ReactNode }) => {
  return (
    <p className="text-sm md:text-base text-left max-w-sm mx-0 my-2 text-neutral-500 dark:text-neutral-300">
      {children}
    </p>
  );
};

const DashboardPreview = () => {
  return (
    <div className="relative flex py-2 px-2 gap-10 h-full">
      <div className="w-full p-5 mx-auto bg-white dark:bg-neutral-900 shadow-sm border rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <CalendarClock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Payment Schedule</h3>
              <p className="text-xs text-gray-500">Auto-updated</p>
            </div>
          </div>
        </div>

        {/* Next Payment Card */}
        <div className="bg-yellow-50 p-4 rounded-xl mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium">Next Payment Due</div>
              <div className="text-xs text-gray-500">In 3 days</div>
            </div>
            <div className="text-lg font-bold">
              $1,000<span className="text-xs font-normal ml-1 text-gray-500">AUD</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full h-2 bg-yellow-100 rounded-full overflow-hidden">
              <div className="w-3/4 h-full bg-yellow-400 rounded-full"></div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Progress</span>
              <span>75%</span>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium mb-3">Recent Activity</h4>

          <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div>
                <span className="text-sm">Sarah paid</span>
                <div className="text-xs text-green-600">Completed • 2m ago</div>
              </div>
            </div>
            <span className="text-sm font-medium">$500</span>
          </div>

          <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <div>
                <span className="text-sm">James pending</span>
                <div className="text-xs text-yellow-600">Awaiting • 5m ago</div>
              </div>
            </div>
            <span className="text-sm font-medium">$500</span>
          </div>

          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <div>
                <span className="text-sm">Group total</span>
                <div className="text-xs text-gray-600">All time</div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium">$1,000</span>
              <div className="text-xs text-green-600">+12.5% ↑</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



const SecurityView = () => {
  return (
    <div className="relative flex items-center justify-center">
      {/* Security Features Grid */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        {/* Payment Security */}
        <div className="bg-white dark:bg-neutral-900 border shadow-sm rounded-xl p-4 hover:border-yellow-300 transition-colors">
          <div className="flex flex-col gap-2">
            <div className="p-2 bg-yellow-100 w-fit rounded-lg">
              <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Stripe Security</h3>
              <p className="text-sm text-gray-500">Industry-leading payment infrastructure with fraud prevention</p>
            </div>
            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-1 bg-yellow-100 rounded-full overflow-hidden"
                >
                  <div className="h-full bg-yellow-400 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Authentication */}
        <div className="bg-white dark:bg-neutral-900 border shadow-sm rounded-xl p-4 hover:border-yellow-300 transition-colors">
          <div className="flex flex-col gap-2">
            <div className="p-2 bg-yellow-100 w-fit rounded-lg">
              <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Kinde Auth</h3>
              <p className="text-sm text-gray-500">Multi-factor authentication & secure session management</p>
            </div>
            <div className="h-1 bg-yellow-100 rounded-full overflow-hidden">
              <div className="w-4/5 h-full bg-yellow-400"></div>
            </div>
          </div>
        </div>

        {/* Identity Verification */}
        <div className="bg-white dark:bg-neutral-900 border shadow-sm rounded-xl p-4 hover:border-yellow-300 transition-colors">
          <div className="flex flex-col gap-2">
            <div className="p-2 bg-yellow-100 w-fit rounded-lg">
              <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold mb-1">ID Verification</h3>
              <p className="text-sm text-gray-500">Automated KYC process & identity validation</p>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-yellow-400" />
              <div className="h-1 flex-1 bg-yellow-100 rounded-full">
                <div className="w-full h-full bg-yellow-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance */}
        <div className="bg-white dark:bg-neutral-900 border shadow-sm rounded-xl p-4 hover:border-yellow-300 transition-colors">
          <div className="flex flex-col gap-2">
            <div className="p-2 bg-yellow-100 w-fit rounded-lg">
              <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Compliance</h3>
              <p className="text-sm text-gray-500">Full regulatory compliance & data protection</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-xs bg-yellow-50 text-yellow-400 px-2 py-1 rounded flex items-center justify-center">
                APP
              </div>
              <div className="text-xs bg-yellow-50 text-yellow-400 px-2 py-1 rounded flex items-center justify-center">
                AML/CTF
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReceiptView = () => {
  return (
    <div className="relative flex py-8 px-2 gap-10 h-full">
      <div className="w-full p-5 mx-auto bg-white dark:bg-neutral-900 shadow-sm border rounded-xl">
        {/* Receipt Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Receipt className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Payment Receipt</h3>
              <p className="text-xs text-gray-500">#1234-5678</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-green-500">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-xs">Verified</span>
          </div>
        </div>

        {/* Amount */}
        <div className="bg-yellow-50 p-4 rounded-xl mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Transaction Amount</div>
              <div className="text-xs text-gray-500">Reference: #1234</div>
            </div>
            <div className="text-lg font-bold">
              $1,000<span className="text-xs font-normal ml-1 text-gray-500">AUD</span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium mb-3">Transaction Details</h4>

          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-gray-400" />
              <span className="text-sm">Date</span>
            </div>
            <span className="text-sm">Oct 27, 2024</span>
          </div>

          <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">Status</span>
            </div>
            <span className="text-sm text-green-600">Completed</span>
          </div>

          <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span className="text-sm">Transaction ID</span>
            </div>
            <span className="text-xs font-mono text-gray-500">txn_1234567890</span>
          </div>
        </div>
      </div>
    </div>
  );
};



const Globe = ({ className }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let phi = 0;

    if (!canvasRef.current) return;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 600 * 2,
      height: 600 * 2,
      phi: 0,
      theta: 0,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.4, 0.4, 0.1], // Changed to yellow tint
      markerColor: [0.9, 0.8, 0.4], // Changed to yellow
      glowColor: [1, 0.9, 0.6], // Changed to yellow glow
      markers: [
        { location: [37.7595, -122.4367], size: 0.03 },
        { location: [40.7128, -74.006], size: 0.03 },
        { location: [51.5074, -0.1278], size: 0.03 },
        { location: [35.6762, 139.6503], size: 0.03 },
      ],
      onRender: (state: any) => {
        state.phi = phi;
        phi += 0.01;
      },
    });

    return () => {
      globe.destroy();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: 600,
        height: 600,
        maxWidth: "100%",
        aspectRatio: 1,
        background: 'transparent'
      }}
      className={className}
    />
  );
};

const GlobeView = () => {
  return (
    <div className="h-60 md:h-60 flex flex-col items-center relative bg-transparent dark:bg-transparent mt-10">
      <Globe className="absolute -right-10 md:-right-10 -bottom-80 md:-bottom-72" />
    </div>
  );
};
const AnalyticsView = () => {
  const monthlyContributions = [
    { month: 'Jan', amount: 12500 },
    { month: 'Feb', amount: 15000 },
    { month: 'Mar', amount: 14000 },
    { month: 'Apr', amount: 16500 },
    { month: 'May', amount: 15500 },
    { month: 'Jun', amount: 17000 },
  ];

  return (
    <div className="relative flex py-2 px-2 gap-10 h-full">
      <div className="w-full p-5 mx-auto bg-white dark:bg-neutral-900 shadow-sm border rounded-xl">
        {/* Analytics Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <LineChart className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Group Analytics</h3>
              <p className="text-xs text-gray-500">Last 6 months</p>
            </div>
          </div>
        </div>

        {/* Main Stats Card */}
        <div className="bg-yellow-50 p-4 rounded-xl">
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">Total Contributions</div>
            <div className="text-3xl font-bold mb-1">$90,500</div>
            <div className="text-xs text-green-600 font-medium">+12.5% vs last month</div>
          </div>
          
          {/* Monthly Progress Chart */}
          <div className="mt-6 space-y-3">
            {monthlyContributions.map((month, index) => (
              <div key={month.month} className="relative">
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="text-gray-600">{month.month}</span>
                  <span className="font-medium">${month.amount.toLocaleString()}</span>
                </div>
                <div className="h-2 w-full bg-yellow-100 rounded-full">
                  <div 
                    className="h-full bg-yellow-500 rounded-full transition-all duration-300"
                    style={{ width: `${(month.amount / 17000) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};


const FeaturesSection = () => {
  const features = [
    {
      title: "Enterprise-Grade Security",
      description: "Built on Stripe's secure payment infrastructure and Kinde's authentication system, featuring bank-level encryption, ID verification, and full regulatory compliance to protect your group's funds.",
      view: <SecurityView />,
      icon: <Shield className="w-6 h-6 text-yellow-400" />,
      className: "col-span-1 lg:col-span-3 border-b lg:border-r dark:border-neutral-800",
    },
    {
      title: "Digital Accessibility",
      description: "Connect and save with group members beyond local boundaries, bringing your collective savings into the digital age with ease and transparency.",
      view: <GlobeView />,
      icon: <BarChart className="w-6 h-6 text-yellow-400" />,
      className: "col-span-1 lg:col-span-3 border-b dark:border-neutral-800",
    },
    {
      title: "Automated Billing",
      description: "Say goodbye to manual collections with automated direct debit contributions, ensuring timely payments and eliminating the need for reminders.",
      view: <DashboardPreview />,
      icon: <CalendarClock className="w-6 h-6 text-yellow-400" />,
      className: "col-span-1 lg:col-span-2 border-b lg:border-r dark:border-neutral-800",
    },
    {
      title: "Digital Receipts",
      description: "Access automated digital receipts for every transaction, maintaining organized records and complete transparency.",
      view: <ReceiptView />,
      icon: <Receipt className="w-6 h-6 text-yellow-400" />,
      className: "col-span-1 lg:col-span-2 border-b lg:border-r dark:border-neutral-800",
    },
    {
      title: "Insightful Analytics",
      description: "Track group performance with detailed contribution analytics, payment trends, and member participation metrics to ensure group success.",
      view: <AnalyticsView />,
      icon: <LineChart className="w-6 h-6 text-yellow-400" />,
      className: "col-span-1 lg:col-span-2 border-b dark:border-neutral-800",
    }
  ];

  return (
    <section className="relative z-20 py-10 lg:py-20">
      <MaxWidthWrapper>
        {/* Header section */}
        <div className="px-8">
          <h2 className="text-3xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-medium text-black dark:text-white">
            Why Choose HivePay? Discover <span className="text-yellow-400">Powerful</span> Features for Seamless Group Savings
          </h2>
          <p className="text-sm lg:text-base max-w-2xl my-4 mx-auto text-neutral-500 text-center dark:text-neutral-300">
            Explore the tools that set HivePay apart and make it the best choice for efficient, secure, and collaborative savings.
          </p>
        </div>

        {/* Features grid */}
        <div className="relative">
          <div className="grid grid-cols-1 lg:grid-cols-6 mt-12 xl:border rounded-xl dark:border-neutral-800">
            {features.map((feature) => (
              <FeatureCard key={feature.title} className={feature.className}>
                <FeatureTitle icon={feature.icon}>{feature.title}</FeatureTitle>
                <FeatureDescription>{feature.description}</FeatureDescription>
                <div className="h-full w-full">{feature.view}</div>
              </FeatureCard>
            ))}
          </div>
        </div>
      </MaxWidthWrapper>
    </section>
  );
};

export default FeaturesSection;