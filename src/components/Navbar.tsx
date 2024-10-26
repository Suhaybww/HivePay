'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import MaxWidthWrapper from '../components/MaxWidthWrapper';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isLoading } = useUser();

  useEffect(() => {
    console.log("Navbar component has been rendered");
  }, []);

  const toggle = () => {
    console.log("Toggle mobile menu");
    setIsOpen(!isOpen);
  };

  return (
    <nav className="sticky top-0 z-30 w-full border-b border-gray-200 bg-white/75 backdrop-blur-lg transition-all">
      <MaxWidthWrapper>
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="text-2xl font-semibold text-gray-900">
           Roundly.
          </Link>

          {/* Mobile Navigation */}
          <button
            className="sm:hidden text-gray-500 hover:text-gray-900"
            onClick={toggle}
          >
            ☰
          </button>

          <div className={`${isOpen ? 'block' : 'hidden'} sm:flex items-center space-x-4`}>
            <Link href="/pricing" className="text-gray-700 hover:text-gray-900">
              Pricing
            </Link>

            {!isLoading && !user ? (
              <>
                <Link
                  href="/api/auth/login"
                  className="text-gray-700 hover:text-gray-900"
                >
                  Sign in
                </Link>
                <Link
                  href="/api/auth/signup"
                  className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-all"
                >
                  Get started
                  <ArrowRight className="ml-1.5 h-5 w-5 inline-block" />
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard" className="text-gray-700 hover:text-gray-900">
                  Dashboard
                </Link>
                <div className="flex items-center space-x-3">
                  {user?.picture && (
                    <Image
                      src={user.picture}
                      alt={user.name || 'User'}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  )}
                  <span className="text-gray-700">{user?.name}</span>
                </div>
                <Link href="/api/auth/logout" className="text-red-500 hover:text-red-700">
                  Logout
                </Link>
              </>
            )}
          </div>
        </div>
      </MaxWidthWrapper>
    </nav>
  );
};

export default Navbar;
