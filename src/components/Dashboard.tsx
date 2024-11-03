'use client';

import Skeleton from 'react-loading-skeleton';
import { FiMail, FiUser, FiPhone } from 'react-icons/fi';

interface PageProps {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string;
    emailVerified: boolean;
    gender: 'Male' | 'Female' | null;
    age: number | null;
    passwordHash: string;
    stripeCustomerId: string | null;
    stripeAccountId: string | null;
    subscriptionStatus: 'Active' | 'Inactive' | 'Canceled';
  };
}

const Dashboard = ({ user }: PageProps) => {
  return (
    <main className="mx-auto max-w-7xl md:p-10">
      <div className="mt-8 flex flex-col items-start justify-between gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:gap-0">
        <h1 className="mb-3 font-bold text-5xl text-gray-900">My Dashboard</h1>
      </div>

      {user ? (
        <div className="mt-8">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">User Information</h3>
            </div>
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="flex items-center text-sm font-medium text-gray-500">
                    <FiUser className="h-5 w-5 mr-2" />
                    Full Name
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {user.firstName ? `${user.firstName} ${user.lastName || ''}` : 'N/A'}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="flex items-center text-sm font-medium text-gray-500">
                    <FiMail className="h-5 w-5 mr-2" />
                    Email Address
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {user.email}
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="flex items-center text-sm font-medium text-gray-500">
                    <FiPhone className="h-5 w-5 mr-2" />
                    Phone Number
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {user.phoneNumber || 'N/A'}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="flex items-center text-sm font-medium text-gray-500">
                    Subscription Status
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {user.subscriptionStatus}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      ) : (
        <Skeleton height={200} className="my-2" />
      )}
    </main>
  );
};

export default Dashboard;