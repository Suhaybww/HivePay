'use client';

import React from 'react';
import MaxWidthWrapper from '@/src/components/MaxWidthWrapper';

const TermsOfService: React.FC = () => {
  return (
    <section className="bg-white text-gray-900 font-sans overflow-hidden py-20">
      <MaxWidthWrapper>
        <div className="space-y-16">
          {/* Page Title */}
          <h1 className="text-5xl font-extrabold text-black text-center">
            Terms and Conditions
          </h1>

          {/* Section 1: Introduction */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">1. Introduction</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              These Terms and Conditions (&ldquo;Terms&rdquo;) govern your use of HivePay Pty Ltd&apos;s
              (&ldquo;HivePay&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) platform and services (&ldquo;Services&rdquo;). By accessing
              or using our Services, you agree to comply with and be bound by these Terms.
              If you don&apos;t agree with these Terms, please discontinue using our Services
              immediately.
            </p>
          </div>

          {/* Section 2: Definitions */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">2. Definitions</h2>
            <p className="text-lg text-gray-700 leading-relaxed">In these Terms:</p>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li>
                <strong>&ldquo;Member&rdquo;</strong> means an individual who has registered and been
                approved to use our Services.
              </li>
              <li>
                <strong>&ldquo;Group&rdquo;</strong> refers to a collection of Members who agree to
                participate in a collective saving and payout cycle.
              </li>
              <li>
                <strong>&ldquo;Contribution&rdquo;</strong> is the amount of money a Member agrees to
                contribute at specified intervals.
              </li>
              <li>
                <strong>&ldquo;Payout&rdquo;</strong> is the lump sum amount received by a Member during
                their scheduled turn in the cycle.
              </li>
              <li>
                <strong>&ldquo;Cycle&rdquo;</strong> refers to the complete sequence of Contributions
                and Payouts among all Group Members.
              </li>
            </ul>
          </div>

          {/* Section 3: Services Overview */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">3. Services Overview</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              HivePay provides a platform that enables Members to form Groups for collective
              saving and financial collaboration. Our Services facilitate the scheduling of
              Contributions, management of Payouts, and provide tools for transparent
              tracking of Group activities. HivePay acts solely as a facilitator and does
              not participate in the agreements between Members beyond providing the
              technological means to do so.
            </p>
          </div>

          {/* Section 4: Eligibility and Registration */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">
              4. Eligibility and Registration
            </h2>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li>
                You must be at least 18 years old and a resident of Australia to use our
                Services.
              </li>
              <li>Provide accurate, current, and complete information during registration.</li>
              <li>Maintain the security of your account by safeguarding your login credentials.</li>
              <li>Agree to update your information promptly if any changes occur.</li>
            </ul>
          </div>

          {/* Section 5: User Responsibilities */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">5. User Responsibilities</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              As a Member, you agree to:
            </p>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li>Use the Services in compliance with these Terms and all applicable laws.</li>
              <li>Only form Groups with individuals you know and trust.</li>
              <li>Fulfill your Contribution obligations on time as agreed upon with your Group.</li>
              <li>Understand and accept the risks involved in collective saving activities.</li>
              <li>Not hold HivePay responsible for the actions or inactions of other Members.</li>
            </ul>
          </div>

          {/* Additional Sections */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">6. Group Formation</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              When creating or joining a Group, you acknowledge that:
            </p>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li>You have reviewed and agreed to the Group&apos;s rules, including Contribution amounts, frequency, and Payout order.</li>
              <li>You are entering into a binding agreement with other Group Members to participate for the entire duration of the Cycle.</li>
              <li>Early withdrawal from a Group may result in penalties or loss of Contributions.</li>
              <li>HivePay is not a party to the agreements between Members and does not mediate disputes.</li>
            </ul>
          </div>

          {/* Section for Contact Information */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">Contact Information</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              If you have any questions or concerns regarding these Terms, please contact us
              at{' '}
              <a href="mailto:support@hivepayapp.com" className="text-yellow-400 underline">
                support@hivepayapp.com
              </a>
              .
            </p>
          </div>
        </div>
      </MaxWidthWrapper>
    </section>
  );
};

export default TermsOfService;