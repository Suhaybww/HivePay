'use client';

import React from 'react';
import MaxWidthWrapper from '@/src/components/MaxWidthWrapper';

const TermsOfService: React.FC = () => {
  return (
    <section className="bg-white text-gray-900 font-sans overflow-hidden py-20">
      <MaxWidthWrapper>
        <div className="space-y-16">
          {/* Page Title */}
          <h1 className="text-5xl font-extrabold text--black text-center">
            Terms and Conditions
          </h1>

          {/* Section 1: Introduction */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">1. Introduction</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              These Terms and Conditions ("Terms") govern your use of HivePay Pty Ltd's ("HivePay", "we", "us", "our") platform and services ("Services"). By accessing or using our Services, you agree to comply with and be bound by these Terms. If you do not agree with these Terms, please discontinue using our Services immediately.
            </p>
          </div>

          {/* Section 2: Definitions */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">2. Definitions</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              In these Terms:
            </p>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li>
                <strong>"Member"</strong> means an individual who has registered and been approved to use our Services.
              </li>
              <li>
                <strong>"Group"</strong> refers to a collection of Members who agree to participate in a collective saving and payout cycle.
              </li>
              <li>
                <strong>"Contribution"</strong> is the amount of money a Member agrees to contribute at specified intervals.
              </li>
              <li>
                <strong>"Payout"</strong> is the lump sum amount received by a Member during their scheduled turn in the cycle.
              </li>
              <li>
                <strong>"Cycle"</strong> refers to the complete sequence of Contributions and Payouts among all Group Members.
              </li>
            </ul>
          </div>

          {/* Section 3: Services Overview */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">3. Services Overview</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              HivePay provides a platform that enables Members to form Groups for collective saving and financial collaboration. Our Services facilitate the scheduling of Contributions, management of Payouts, and provide tools for transparent tracking of Group activities. HivePay acts solely as a facilitator and does not participate in the agreements between Members beyond providing the technological means to do so.
            </p>
          </div>

          {/* Section 4: Eligibility and Registration */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">4. Eligibility and Registration</h2>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li>You must be at least 18 years old and a resident of Australia to use our Services.</li>
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

          {/* Section 6: Group Formation and Participation */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">6. Group Formation and Participation</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              When creating or joining a Group, you acknowledge that:
            </p>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li>You have reviewed and agreed to the Group's rules, including Contribution amounts, frequency, and Payout order.</li>
              <li>You are entering into a binding agreement with other Group Members to participate for the entire duration of the Cycle.</li>
              <li>Early withdrawal from a Group may result in penalties or loss of Contributions, as determined by the Group's rules.</li>
              <li>HivePay is not a party to the agreements between Members and does not mediate disputes.</li>
            </ul>
          </div>

          {/* Section 7: Financial Transactions */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">7. Financial Transactions</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              HivePay facilitates financial transactions among Members using secure third-party payment processors. By using our Services, you:
            </p>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li>Authorize HivePay to debit your account for agreed Contributions.</li>
              <li>Authorize HivePay to credit Payouts to your account when it is your turn in the Cycle.</li>
              <li>Acknowledge that HivePay is not a bank or financial institution and does not hold funds beyond facilitating transactions.</li>
            </ul>
          </div>

          {/* Section 8: Fees and Charges */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">8. Fees and Charges</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              HivePay charges a service fee for the use of our platform. The fees are as follows:
            </p>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li>A monthly subscription fee disclosed during registration.</li>
              <li>Transaction fees for processing Contributions and Payouts, if applicable.</li>
              <li>Administrative fees for failed or returned transactions due to insufficient funds or other errors.</li>
            </ul>
            <p className="text-lg text-gray-700 leading-relaxed">
              We reserve the right to change our fees with prior notice to you.
            </p>
          </div>

          {/* Section 9: Risk of Financial Loss */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">9. Risk of Financial Loss</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              Participating in Group saving activities carries inherent risks, including but not limited to:
            </p>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li>Non-payment or default by other Group Members.</li>
              <li>Loss of Contributions if other Members fail to honor their obligations.</li>
            </ul>
            <p className="text-lg text-gray-700 leading-relaxed">
              HivePay is not liable for any losses incurred due to the actions of other Members. You agree to bear these risks when participating in Groups.
            </p>
          </div>

          {/* Section 10: Prohibited Activities */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">10. Prohibited Activities</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              You agree not to engage in the following activities:
            </p>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li>Use the Services for illegal, fraudulent, or unauthorized purposes.</li>
              <li>Harass, threaten, or harm other Members.</li>
              <li>Impersonate any person or entity or misrepresent your affiliation.</li>
              <li>Attempt to interfere with or disrupt the integrity of the platform.</li>
              <li>Collect or harvest personal information of other Members without consent.</li>
            </ul>
          </div>

          {/* Section 11: Termination and Suspension */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">11. Termination and Suspension</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              HivePay reserves the right to suspend or terminate your account if you violate these Terms or engage in activities that harm the platform or other Members. Upon termination:
            </p>
            <ul className="list-disc pl-5 text-lg text-gray-700 space-y-2">
              <li>You remain responsible for any outstanding obligations to Groups you participate in.</li>
              <li>HivePay may prohibit you from re-registering or accessing the Services in the future.</li>
            </ul>
          </div>

          {/* Section 12: Limitation of Liability */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">12. Limitation of Liability</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              To the maximum extent permitted by law, HivePay is not liable for any indirect, incidental, special, consequential, or exemplary damages, including loss of profits, goodwill, or data. Our total liability to you for any claim arising out of or relating to these Terms or the Services is limited to the amount of fees you paid to HivePay in the twelve months preceding the claim.
            </p>
          </div>

          {/* Section 13: Indemnification */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">13. Indemnification</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              You agree to indemnify and hold harmless HivePay, its affiliates, officers, agents, and employees from any claim or demand arising out of your use of the Services, violation of these Terms, or infringement of any rights of another.
            </p>
          </div>

          {/* Section 14: Intellectual Property */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">14. Intellectual Property</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              All content, trademarks, and data on the HivePay platform, including software, databases, text, graphics, icons, and hyperlinks are the property of or licensed to HivePay. Unauthorized use, distribution, or reproduction is prohibited.
            </p>
          </div>

          {/* Section 15: Privacy */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">15. Privacy</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              Your privacy is important to us. Please review our <a href="/privacy-policy" className="text-yellow-400 underline">Privacy Policy</a> to understand how we collect, use, and protect your personal information.
            </p>
          </div>

          {/* Section 16: Governing Law */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">16. Governing Law</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              These Terms are governed by the laws of Australia. You agree to submit to the exclusive jurisdiction of the courts located within Australia to resolve any legal matter arising from these Terms.
            </p>
          </div>

          {/* Section 17: Amendments */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">17. Amendments</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              HivePay may modify these Terms at any time. We will notify you of significant changes via email or through the platform. Continued use of the Services after changes indicates your acceptance of the new Terms.
            </p>
          </div>

          {/* Section 18: Contact Information */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-yellow-400">18. Contact Information</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              If you have any questions or concerns regarding these Terms, please contact us at <a href="mailto:hivepay.team@gmail.com" className="text-yellow-400 underline">hivepay.team@gmail.com</a>.
            </p>
          </div>
        </div>
      </MaxWidthWrapper>
    </section>
  );
};

export default TermsOfService;
