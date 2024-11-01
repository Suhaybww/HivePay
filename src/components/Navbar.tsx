'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import MaxWidthWrapper from './MaxWidthWrapper';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isLoading } = useUser();

  return (
    <nav className="sticky top-0 z-30 w-full border-b border-gray-200 bg-white/75 backdrop-blur-lg transition-all">
      <MaxWidthWrapper>
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="text-2xl font-semibold text-gray-900">
            Roundly.
          </Link>

          {/* Mobile menu button */}
          <div className="sm:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-500 hover:text-gray-900"
            >
              ☰
            </button>
          </div>

          {/* Desktop navigation */}
          <div className={`hidden sm:flex items-center space-x-4`}>
            <Link href="/pricing" className="text-gray-700 hover:text-gray-900">
              Pricing
            </Link>

            {!isLoading && (
              <>
                {!user ? (
                  <>
                    <Link
                      href="/api/auth/login"
                      className="text-gray-700 hover:text-gray-900"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/api/auth/signup"
                      className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-all flex items-center"
                    >
                      Get started
                      <ArrowRight className="ml-1.5 h-5 w-5" />
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/dashboard" className="text-gray-700 hover:text-gray-900">
                      Dashboard
                    </Link>
                    <div className="flex items-center space-x-3">
                      {user.picture && (
                        <Image
                          src={user.picture}
                          alt={user.name || 'User'}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                      )}
                      <span className="text-gray-700">{user.name}</span>
                    </div>
                    <Link href="/api/auth/logout" className="text-red-500 hover:text-red-700">
                      Logout
                    </Link>
                  </>
                )}
              </>
            )}
          </div>

          {/* Mobile navigation */}
          {isOpen && (
            <div className="sm:hidden absolute top-14 left-0 right-0 bg-white border-b border-gray-200 py-2 px-4 space-y-2">
              <Link
                href="/pricing"
                className="block px-3 py-2 text-gray-700 hover:text-gray-900"
                onClick={() => setIsOpen(false)}
              >
                Pricing
              </Link>

              {!isLoading && (
                <>
                  {!user ? (
                    <>
                      <Link
                        href="/api/auth/login"
                        className="block px-3 py-2 text-gray-700 hover:text-gray-900"
                        onClick={() => setIsOpen(false)}
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/api/auth/signup"
                        className="block px-3 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-700"
                        onClick={() => setIsOpen(false)}
                      >
                        Get started <ArrowRight className="inline ml-1.5 h-5 w-5" />
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/dashboard"
                        className="block px-3 py-2 text-gray-700 hover:text-gray-900"
                        onClick={() => setIsOpen(false)}
                      >
                        Dashboard
                      </Link>
                      <div className="px-3 py-2 flex items-center space-x-2">
                        {user.picture && (
                          <Image
                            src={user.picture}
                            alt={user.name || 'User'}
                            width={32}
                            height={32}
                            className="rounded-full"
                          />
                        )}
                        <span className="text-gray-700">{user.name}</span>
                      </div>
                      <Link
                        href="/api/auth/logout"
                        className="block px-3 py-2 text-red-600 hover:text-red-700"
                        onClick={() => setIsOpen(false)}
                      >
                        Logout
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </MaxWidthWrapper>
    </nav>
  );
};

export default Navbar;