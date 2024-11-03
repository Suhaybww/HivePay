"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/src/app/_trpc/client';
import { Loader2 } from 'lucide-react';

const OnboardingPage = () => {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { mutate: updateUser } = trpc.updateUserDetails.useMutation({
    onSuccess: () => {
      window.location.href = '/dashboard';
    },
    onError: () => {
      setIsSubmitting(false);
      alert('Something went wrong. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    updateUser({
      phoneNumber,
      age: parseInt(age, 10),
      gender: gender as 'Male' | 'Female',
    });
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-50 z-50 flex items-center justify-center backdrop-blur-md">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg mx-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Complete Your Profile</h2>
          <p className="text-md text-gray-500">
            Please provide these additional details to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              required
              placeholder="+1234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Age
            </label>
            <input
              type="number"
              required
              min="18"
              max="120"
              placeholder="25"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Gender
            </label>
            <select
              required
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed mt-8"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                Completing Profile...
              </span>
            ) : (
              'Complete Profile'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OnboardingPage;
