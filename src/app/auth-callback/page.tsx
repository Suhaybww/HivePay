"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '../_trpc/client';
import { Loader2 } from 'lucide-react';
import { toast } from '@/src/components/ui/use-toast';
import { useEffect } from 'react';

const Page = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const origin = searchParams.get('origin');

  const { isError, error } = trpc.auth.authCallback.useQuery(undefined, {
    onSuccess: ({ success }) => {
      if (success) {
        const redirectPath = origin ? `/${origin}` : '/dashboard';
        window.location.href = redirectPath;
      }
    },
    onError: (err) => {
      if (err.data?.code === 'UNAUTHORIZED') {
        router.push('/api/auth/login');
      } else if (err.data?.code === 'CONFLICT') {
        toast({
          title: "Account Already Exists",
          description: "An account with this email already exists.",
          variant: "destructive",
        });
        router.push('/');
      } else {
        toast({
          title: "Error",
          description: "Something went wrong. Please try again later.",
          variant: "destructive",
        });
        router.push('/');
      }
    },
    retry: (failureCount, error) => {
      if (error.data?.code === 'CONFLICT') return false;
      return failureCount < 3;
    },
    retryDelay: 500,
  });

  return (
    <div className="w-full mt-24 flex justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-800" />
        <h3 className="font-semibold text-xl">Setting up your account...</h3>
        <p>You will be redirected automatically.</p>
      </div>
    </div>
  );
};

export default Page;