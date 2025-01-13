import React from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/src/components/ui/accordion";
import { cn } from "@/src/lib/utils";

export default function FAQsPage() {
  const faqs = [
    {
      question: "What is HivePay?",
      answer:
        "HivePay is a digital platform for secure and automated rotating savings. It helps trusted groups save and distribute funds with transparency, replacing traditional manual systems with a streamlined digital experience.",
    },
    {
      question: "How does HivePay handle payments?",
      answer:
        "HivePay uses BECS for direct debit to collect contributions from all members. Once everyone’s payment is confirmed, Stripe Connect sends the total payout directly to the designated member's bank account.",
    },
    {
      question: "Who decides the payout order?",
      answer:
        "HivePay uses an automated algorithm to manage the payout order by default. However, group admins have the ability to rearrange the payout order if required, ensuring flexibility and fairness for the group.",
    },
    {
      question: "What happens if a member wants to leave early?",
      answer:
        "Once the contribution cycle begins, members cannot leave the group. This ensures all members fulfill their commitment and prevents disruptions in the payout schedule.",
    },
    {
      question: "Can I access the funds before my turn?",
      answer:
        "No, funds are securely held until it's your turn in the payout order. This ensures fairness and adherence to the group’s agreed rules.",
    },
    {
      question: "How does HivePay ensure fairness in payouts?",
      answer:
        "HivePay verifies all member contributions before releasing payouts. Admins can adjust the order if necessary, and the system guarantees everyone receives their payout based on the agreed schedule.",
    },
    {
      question: "What if a member misses a payment?",
      answer:
        "If a member misses a payment, HivePay notifies them and the group admin. The payout is delayed until all contributions are received to maintain fairness for the receiving member.",
    },
    {
      question: "What bank details are required to join?",
      answer:
        "Members must provide valid bank account details during registration to enable secure direct debits and payouts via Stripe Connect.",
    },
    {
      question: "How secure is HivePay?",
      answer:
        "HivePay is built on Stripe’s secure payment infrastructure and Kinde’s authentication. It features bank-level encryption, ID verification, and compliance with GDPR and PCI DSS standards.",
    },
    {
      question: "Can group admins manage member actions?",
      answer:
        "Yes, group admins have additional controls, such as rearranging payout orders, approving new members, and monitoring payment statuses to ensure smooth operations.",
    },
    {
      question: "How do I track group progress?",
      answer:
        "HivePay provides real-time analytics and detailed tracking tools. You can view member contributions, payout schedules, and overall group performance with ease.",
    },
    {
      question: "What happens when the savings event ends?",
      answer:
        "At the end of a savings event, HivePay provides a detailed summary of all contributions, payouts, and group activity. Members can then start a new event or join another group.",
    },
    {
      question: "Can I have multiple active groups?",
      answer:
        "Yes, HivePay allows you to participate in multiple groups at the same time, with each group managed independently to suit different savings goals.",
    },
    {
      question: "What happens if an admin needs to change the group settings?",
      answer:
        "Admins can update group settings, such as payout order and event duration, at any time. Changes will be communicated to all members for transparency.",
    },
    {
      question: "Are there any fees for using HivePay?",
      answer:
        "HivePay charges a minimal transaction fee to cover direct debit and payout processing. The fee ensures a secure and seamless experience for all users.",
    },
  ];

  return (
    <main className="min-h-screen bg-white py-10">
      <section className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-center text-4xl font-bold text-gray-800">Frequently Asked Questions</h1>
        <p className="text-center text-lg text-gray-600 mt-2">
          Find answers to the most common questions about HivePay.
        </p>
        <Accordion type="single" collapsible className="mt-8">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`faq-${index}`}>
              <AccordionTrigger
                className={cn(
                  "text-gray-800 font-semibold text-lg px-4 py-3 border-b border-gray-300 hover:bg-gray-100",
                  "focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                )}
              >
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-gray-700 px-4 py-3 bg-gray-50 border-t border-yellow-400">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <footer className="mt-12 border-t border-gray-200 py-6">
        <div className="container mx-auto text-center text-sm text-gray-600">
          <p>
            Powered by{" "}
            {" "}
            <a
              href="https://stripe.com/au/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:underline"
            >
              Stripe Connect
            </a>
            . Authentication provided by{" "}
            <a
              href="https://docs.kinde.com/trust-center/agreements/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:underline"
            >
              Kinde
            </a>
            .
          </p>
        </div>
      </footer>
    </main>
  );
}
