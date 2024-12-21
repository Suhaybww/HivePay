'use client';

import React from 'react';
import MaxWidthWrapper from '@/src/components/MaxWidthWrapper';

const PrivacyPage: React.FC = () => {
  return (
    <section className="bg-white text-gray-900 font-sans overflow-hidden py-20">
      <MaxWidthWrapper>
        <div className="space-y-16">
          {/* Page Title */}
          <h1 className="text-5xl font-extrabold text-black text-center">
            Privacy Policy
          </h1>

          {/* Section 1 */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">1. Our Commitment</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              HivePay Pty Ltd (“HivePay”, “we”, “our”, or “us”) is dedicated to safeguarding your personal information. We take privacy seriously and comply with the Privacy Act 1988 (Cth) and the Australian Privacy Principles. This Privacy Policy outlines how we collect, use, and protect your personal information.
            </p>
          </div>

          {/* Section 2 */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">2. Information We Collect</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              We collect a range of personal information to provide our services effectively:
            </p>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li><strong>Personal Details:</strong> Your name, contact details, and address.</li>
              <li><strong>Financial Information:</strong> Bank details and transaction history.</li>
              <li><strong>Usage Data:</strong> Information about your interactions with our platform.</li>
              <li><strong>Optional Data:</strong> Preferences or additional details you provide.</li>
            </ul>
          </div>

          {/* Section 3 */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">3. How We Collect Your Information</h2>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li><strong>Directly:</strong> From forms, registrations, or communication with us.</li>
              <li><strong>Automatically:</strong> Through cookies and device data when you use our platform.</li>
              <li><strong>From Third Parties:</strong> Payment processors or identity verification services.</li>
            </ul>
          </div>

          {/* Section 4 */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">4. How We Use Your Information</h2>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li>To process contributions, payouts, and account management.</li>
              <li>To improve our platform and services based on usage data.</li>
              <li>To communicate updates and changes to our services.</li>
              <li>To ensure compliance with legal obligations.</li>
            </ul>
          </div>

          {/* Section 5 */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">5. Sharing Your Information</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              We only share your personal information in the following situations:
            </p>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li>With your consent to provide our services (e.g., payment providers).</li>
              <li>To comply with legal requirements under Australian law.</li>
              <li>With trusted third-party providers for fraud prevention or analytics.</li>
            </ul>
          </div>

          {/* Section 6 */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">6. Protecting Your Information</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              We take all reasonable steps to safeguard your personal information. These include secure data storage, encryption, and regular system monitoring. However, no method is completely secure, and we advise you to exercise caution when sharing sensitive information.
            </p>
          </div>

          {/* Section 7 */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">7. Your Rights</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              You have the right to:
            </p>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li>Request access to the personal information we hold about you.</li>
              <li>Request correction of inaccurate information.</li>
              <li>Request deletion of your personal information, subject to legal requirements.</li>
            </ul>
            <p className="text-lg text-gray-700 leading-relaxed">
              For any of these requests, please contact us at <a href="mailto:support@hivepay.com.au" className="text-yellow-400 underline">support@hivepay.com.au</a>.
            </p>
          </div>

          {/* Section 8 */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">8. Updates to This Policy</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              HivePay may update this Privacy Policy from time to time to reflect changes in our services or compliance with legal obligations. We recommend reviewing this page periodically to stay informed.
            </p>
          </div>
        </div>
      </MaxWidthWrapper>
    </section>
  );
};

export default PrivacyPage;
