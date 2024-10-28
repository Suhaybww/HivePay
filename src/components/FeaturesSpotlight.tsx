"use client";

import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { CalendarClock, Receipt, Shield, BarChart, Users, LineChart } from "lucide-react";
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
      {icon && <div className="text-purple-600 dark:text-purple-400">{icon}</div>}
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
    <div className="relative flex py-8 px-2 gap-10 h-full">
      <div className="w-full p-5 mx-auto bg-white dark:bg-neutral-900 shadow-2xl group h-full rounded-lg">
        <div className="flex flex-col space-y-4">
          {/* Dashboard Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                <CalendarClock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-sm font-medium text-purple-900 dark:text-purple-100">Payment Schedule</div>
            </div>
            <div className="text-xs text-purple-500">Auto-updated</div>
          </div>

          {/* Next Payment Card */}
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-purple-900 dark:text-purple-100">Next Payment Due</div>
                <div className="text-xs text-purple-600 dark:text-purple-300">In 3 days</div>
              </div>
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                $250
                <span className="text-xs font-normal ml-1">GBP</span>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="mt-3">
              <div className="w-full h-1.5 bg-purple-200 dark:bg-purple-800 rounded-full overflow-hidden">
                <div className="w-3/4 h-full bg-purple-600 rounded-full"></div>
              </div>
              <div className="flex justify-between mt-1 text-xs text-purple-500">
                <span>Progress</span>
                <span>75%</span>
              </div>
            </div>
          </div>
          
          {/* Recent Activity List */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">Recent Activity</div>
            
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">Sarah paid</span>
                  <div className="text-xs text-green-600">Completed • 2m ago</div>
                </div>
              </div>
              <span className="text-sm font-medium">$50</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">James pending</span>
                  <div className="text-xs text-yellow-600">Awaiting • 5m ago</div>
                </div>
              </div>
              <span className="text-sm font-medium">$50</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">Group total</span>
                  <div className="text-xs text-purple-600">All time</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium">$1,250</span>
                <div className="text-xs text-green-600">+12.5% ↑</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};




const SecurityView = () => {
  return (
    <div className="relative h-full flex items-center justify-center">
      <div className="space-y-6 w-full">
        {/* Main Security Status */}
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              <span className="text-sm font-semibold text-green-600">System Secure</span>
            </div>
            <div className="animate-pulse h-2 w-2 rounded-full bg-green-500"></div>
          </div>
        </div>

        {/* Security Features Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg transform transition-all hover:scale-105">
            <div className="text-sm font-medium text-purple-900 dark:text-purple-100">Encryption</div>
            <div className="text-xs text-purple-600 dark:text-purple-300 mt-1">AES-256</div>
            <div className="mt-2 flex space-x-1">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-1 h-3 bg-purple-400 dark:bg-purple-600 rounded-full animate-pulse" style={{ animationDelay: `${i * 200}ms` }}></div>
              ))}
            </div>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg transform transition-all hover:scale-105">
            <div className="text-sm font-medium text-purple-900 dark:text-purple-100">2FA</div>
            <div className="text-xs text-purple-600 dark:text-purple-300 mt-1">Enabled</div>
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-purple-400 animate-ping"></div>
                <div className="h-1 flex-1 bg-purple-200 rounded-full">
                  <div className="w-full h-full bg-purple-500 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg transform transition-all hover:scale-105">
            <div className="text-sm font-medium text-purple-900 dark:text-purple-100">SSL</div>
            <div className="text-xs text-purple-600 dark:text-purple-300 mt-1">TLS 1.3</div>
            <div className="mt-2 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-purple-600 opacity-20 animate-pulse rounded-full"></div>
              <Shield className="w-4 h-4 text-purple-600" />
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg transform transition-all hover:scale-105">
            <div className="text-sm font-medium text-purple-900 dark:text-purple-100">Compliance</div>
            <div className="text-xs text-purple-600 dark:text-purple-300 mt-1">GDPR</div>
            <div className="mt-2">
              <div className="w-full h-1.5 bg-purple-200 rounded-full overflow-hidden">
                <div className="w-full h-full bg-gradient-to-r from-purple-400 to-purple-600 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Security Scanner */}
        <div className="bg-purple-50/50 dark:bg-purple-900/10 rounded-lg p-2">
          <div className="flex justify-between items-center text-xs text-purple-600 dark:text-purple-400">
            <span>Security Scan</span>
            <span>Real-time</span>
          </div>
          <div className="mt-1 flex space-x-1">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="flex-1 h-1 bg-purple-200 dark:bg-purple-800 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-purple-600 dark:bg-purple-400 animate-pulse"
                  style={{ animationDelay: `${i * 100}ms` }}
                ></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};



const ReceiptView = () => {
  return (
    <div className="relative flex py-8 px-2 gap-10 h-full">
      <div className="w-full p-5 mx-auto bg-white dark:bg-neutral-900 shadow-2xl group h-full rounded-lg">
        <div className="flex flex-col space-y-4">
          {/* Receipt Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-sm font-medium text-purple-900 dark:text-purple-100">Payment Receipt</div>
            </div>
            <div className="text-xs text-green-500">Verified</div>
          </div>

          {/* Receipt Details */}
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-purple-900 dark:text-purple-100">Transaction Amount</div>
                <div className="text-xs text-purple-600">Reference: #1234</div>
              </div>
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                $50.00
                <span className="text-xs font-normal ml-1">GBP</span>
              </div>
            </div>
          </div>
          
          {/* Transaction Details */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">Transaction Details</div>
            
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">Date</span>
              </div>
              <span className="text-sm font-medium">Oct 27, 2024</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">Status</span>
              </div>
              <span className="text-sm font-medium text-green-600">Completed</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">Transaction ID</span>
                  <div className="text-xs text-purple-600 font-mono">txn_1234567890</div>
                </div>
              </div>
            </div>
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
      baseColor: [0.4, 0.3, 0.6],
      markerColor: [0.6, 0.4, 0.9],
      glowColor: [0.8, 0.6, 1],
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
  return (
    <div className="relative flex py-8 px-2 gap-10 h-full">
      <div className="w-full p-5 mx-auto bg-white dark:bg-neutral-900 shadow-2xl group h-full rounded-lg">
        <div className="flex flex-col space-y-4">
          {/* Analytics Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                <LineChart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-sm font-medium text-purple-900 dark:text-purple-100">Performance Analytics</div>
            </div>
            <div className="text-xs text-purple-500">Live Data</div>
          </div>

          {/* Main Stats Card */}
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-purple-900 dark:text-purple-100">Total Savings</div>
                <div className="text-xs text-green-600">+12.5% from last month</div>
              </div>
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                $15,000
                <span className="text-xs font-normal ml-1">USD</span>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="mt-3">
              <div className="w-full h-1.5 bg-purple-200 dark:bg-purple-800 rounded-full overflow-hidden">
                <div className="w-3/4 h-full bg-purple-600 rounded-full"></div>
              </div>
              <div className="flex justify-between mt-1 text-xs text-purple-500">
                <span>Progress</span>
                <span>75%</span>
              </div>
            </div>
          </div>
          
          {/* Activity Stats */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">Activity Overview</div>
            
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">Active Users</span>
                  <div className="text-xs text-green-600">32 • +4 today</div>
                </div>
              </div>
              <span className="text-sm font-medium">98%</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">Transactions</span>
                  <div className="text-xs text-blue-600">128 • +12 today</div>
                </div>
              </div>
              <span className="text-sm font-medium">↑</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">Performance Score</span>
                  <div className="text-xs text-purple-600">94/100</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium">A+</span>
                <div className="text-xs text-green-600">+2.5% ↑</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CommunityView = () => {
  return (
    <div className="relative h-full flex items-center justify-center bg-white dark:bg-neutral-900 p-4 rounded-lg shadow-lg">
      <div className="w-full space-y-3">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { title: 'Core', count: 5, color: 'from-purple-400 to-purple-600' },
            { title: 'Active', count: 8, color: 'from-blue-400 to-blue-600' },
            { title: 'New', count: 2, color: 'from-green-400 to-green-600' }
          ].map((item, i) => (
            <div key={i} className="p-2 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
              <div className={`w-6 h-6 mx-auto rounded-md bg-gradient-to-br ${item.color} flex items-center justify-center text-white text-sm font-bold`}>
                {item.count}
              </div>
              <div className="text-xs text-purple-600 text-center mt-1">{item.title}</div>
            </div>
          ))}
        </div>

        {/* Trust Score */}
        <div className="flex items-center justify-between bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-2 rounded-lg">
          <div>
            <span className="text-xs text-purple-600">Trust Score</span>
            <div className="text-lg font-bold text-purple-900 dark:text-purple-100">4.9</div>
          </div>
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className={`w-4 h-4 ${i < 4 ? 'text-purple-500' : 'text-purple-300'}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-1.5">
          {[
            { action: "New member joined", time: "2m ago", icon: "👋" },
            { action: "Payment completed", time: "5m ago", icon: "💰" },
            { action: "Milestone reached", time: "1h ago", icon: "🎯" }
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 p-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg">
              <div className="w-5 h-5 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center text-xs">
                {item.icon}
              </div>
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400">{item.action}</div>
                <div className="text-xs text-purple-500">{item.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const FeaturesSection = () => {
  const features = [
    {
      title: "Security Measures",
      description: "Benefit from data encryption, two-factor authentication, and compliance with financial regulations, ensuring that your group's funds and personal information remain safe.",
      view: <SecurityView />,
      icon: <Shield className="w-6 h-6" />,
      className: "col-span-1 lg:col-span-3 border-b lg:border-r dark:border-neutral-800",
    },
    {
      title: "Digital Accessibility",
      description: "Connect and save with group members beyond local boundaries, bringing your collective savings into the digital age with ease and transparency.",
      view: <GlobeView />,
      icon: <BarChart className="w-6 h-6" />,
      className: "col-span-1 lg:col-span-3 border-b dark:border-neutral-800",
      
    },
    {
      title: "Automated Billing",
      description: "Say goodbye to manual collections with automated direct debit contributions, ensuring timely payments and eliminating the need for reminders.",
      view: <DashboardPreview />,
      icon: <CalendarClock className="w-6 h-6" />,
      className: "col-span-1 lg:col-span-2 border-b lg:border-r dark:border-neutral-800",
    },
    {
      title: "Digital Receipts",
      description: "Access automated digital receipts for every transaction, maintaining organized records and complete transparency.",
      view: <ReceiptView />,
      icon: <Receipt className="w-6 h-6" />,
      className: "col-span-1 lg:col-span-2 border-b lg:border-r dark:border-neutral-800",
    },
    {
      title: "Insightful Analytics",
      description: "Track contributions, payouts, and group performance with detailed graphs and real-time data analysis.",
      view: <AnalyticsView />,
      icon: <LineChart className="w-6 h-6" />,
      className: "col-span-1 lg:col-span-2 border-b dark:border-neutral-800",
    },
    {
      title: "Community Building",
      description: "Foster stronger bonds within your group through collaborative saving and transparent group management.",
      view: <CommunityView />,
      icon: <Users className="w-6 h-6" />,
      className: "col-span-1 lg:col-span-6 dark:border-neutral-800",
    },
  ];

  return (
    <section className="relative z-20 py-10 lg:py-20">
      <MaxWidthWrapper>
        {/* Header section */}
        <div className="px-8">
          <h2 className="text-3xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-medium text-black dark:text-white">
            Why Choose Roundly? Discover <span className="text-purple-600">Powerful</span> Features for Seamless Group Savings
          </h2>
          <p className="text-sm lg:text-base max-w-2xl my-4 mx-auto text-neutral-500 text-center dark:text-neutral-300">
            Explore the tools that set Roundly apart and make it the best choice for efficient, secure, and collaborative savings.
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