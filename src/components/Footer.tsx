import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { name: 'About', href: '/company/about' },
      { name: 'Pricing', href: '/pricing' },
      { name: 'FAQs', href: '/company/faqs' },
      { name: 'Contact', href: '/company/contact' },
    ],
    legal: [
      { name: 'Privacy Policy', href: '/legal/privacy' },
      { name: 'Terms of Service', href: '/legal/terms' },
    ],
  };

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800">
      <div className="mx-auto max-w-7xl px-6 py-12 md:py-16 lg:px-8">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center">
              <Image 
                src="/images/HivePay.svg" 
                alt="HivePay Logo" 
                width={96} 
                height={96}
              />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">HivePay</span>
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs">
              Transforming traditional group savings into a seamless digital experience. Save and grow wealth together.
            </p>
          </div>

          {/* Links Sections */}
          <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
            {/* Product Links */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Product</h3>
              <ul className="mt-4 space-y-3">
                {footerLinks.product.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-yellow-400 dark:text-gray-400 dark:hover:text-yellow-500 transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Legal</h3>
              <ul className="mt-4 space-y-3">
                {footerLinks.legal.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-yellow-400 dark:text-gray-400 dark:hover:text-yellow-500 transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-center md:text-left text-gray-600 dark:text-gray-400">
            © {currentYear} HivePay Pty Ltd (ACN: 683 103 808). All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
