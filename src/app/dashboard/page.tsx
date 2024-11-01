'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { redirect } from 'next/navigation';

export default function Dashboard() {
  const { user, error, isLoading } = useUser();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>{error.message}</div>;
  if (!user) {
    redirect('/api/auth/login');
    return null;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome {user.name}!</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Profile Information</h2>
          <p>Email: {user.email}</p>
          {user.email_verified && <p className="text-green-600">✓ Email verified</p>}
        </div>
      </div>
    </div>
  );
}