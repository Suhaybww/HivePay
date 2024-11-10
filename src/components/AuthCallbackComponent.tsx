'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '../app/_trpc/client';
import { Loader2 } from 'lucide-react';

const AuthCallbackComponent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const origin = searchParams.get('origin');

  console.log('Rendering auth-callback component');

  // Fetch authentication callback data with retry logic
  const { data, error, isLoading } = trpc.auth.authCallback.useQuery(undefined, {
    retry: true,
    retryDelay: 500,
  });
  

  console.log('Authentication callback data:', data);
  console.log('Authentication callback error:', error);
  console.log('Authentication callback isLoading:', isLoading);

  if (data?.success) {
    console.log('Authentication successful, redirecting to dashboard');
    // Redirect user to dashboard if authentication is successful
    router.push(origin || '/dashboard');
  }

  if (error?.data?.code === 'UNAUTHORIZED') {
    console.error('Unauthorized, redirecting to sign-in page');
    // Redirect to sign-in page if unauthorized
    router.push('/sign-in');
  }

  if (isLoading) {
    console.log('Authentication callback is loading');
    // Show loading state while authentication callback is in progress
    return (
      <div className='w-full mt-24 flex justify-center'>
        <div className='flex flex-col items-center gap-2'>
          <Loader2 className='h-8 w-8 animate-spin text-zinc-800' />
          <h3 className='font-semibold text-xl'>
            Setting up your account...
          </h3>
          <p>You will be redirected automatically.</p>
        </div>
      </div>
    );
  }

  console.log('Authentication callback completed, no conditions met');
  // Return null if no conditions are met (fallback)
  return null;
};

export default AuthCallbackComponent;