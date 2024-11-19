// src/app/dashboard/feedback/page.tsx

"use client"

import React from 'react';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Textarea } from '@/src/components/ui/text-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { useToast } from '@/src/components/ui/use-toast';
import { trpc } from '../../_trpc/client';
import { StarIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from 'react-error-boundary';

interface FeedbackFormData {
  type: string;
  title: string;
  description: string;
}

interface ErrorFallbackProps {
    error: Error;
    resetErrorBoundary: () => void;
  }
  

const FeedbackForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [rating, setRating] = React.useState(0);
  const [hoveredRating, setHoveredRating] = React.useState(0);
  const [formData, setFormData] = React.useState<FeedbackFormData>({
    type: '',
    title: '',
    description: ''
  });

  const submitFeedback = trpc.support.submitFeedback.useMutation({
    onSuccess: () => {
      toast({
        title: 'Thank you for your feedback!',
        description: 'We appreciate your input and will review it carefully.',
        variant: 'default',
      });
      // Reset form
      setFormData({ type: '', title: '', description: '' });
      setRating(0);
    },
    onError: (error) => {
      toast({
        title: 'Something went wrong',
        description: error.message || 'Please try again later',
        variant: 'destructive',
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await submitFeedback.mutateAsync({
        ...formData,
        rating,
        type: formData.type as 'suggestion' | 'bug' | 'improvement' | 'other'
      });
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formData.type && formData.title && formData.description && rating > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gray-50/40 py-8 px-4"
    >
      <div className="max-w-2xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Share Your Feedback</h1>
          <p className="mt-2 text-gray-600">
            Help us improve HivePay by sharing your thoughts and experiences
          </p>
        </div>

        <Card className="p-6 shadow-sm bg-white">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rating Section */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                How would you rate your experience?
              </label>
              <div className="flex gap-1 justify-center sm:justify-start">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    className="focus:outline-none"
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    onClick={() => setRating(star)}
                  >
                    <StarIcon
                      className={`w-8 h-8 transition-colors ${
                        star <= (hoveredRating || rating)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Feedback Type */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                What type of feedback do you have?
              </label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select feedback type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suggestion">💡 Suggestion</SelectItem>
                  <SelectItem value="bug">🐛 Bug Report</SelectItem>
                  <SelectItem value="improvement">⚡ Improvement</SelectItem>
                  <SelectItem value="other">✨ Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Title
              </label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Brief summary of your feedback"
                className="w-full"
                maxLength={100}
              />
              <p className="text-xs text-gray-500">
                {formData.title.length}/100 characters
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Detailed Feedback
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Please provide specific details about your feedback..."
                className="h-32 resize-none"
                maxLength={500}
              />
              <p className="text-xs text-gray-500">
                {formData.description.length}/500 characters
              </p>
            </div>

            {/* Submit Button */}
            <AnimatePresence mode="wait">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Button
                  type="submit"
                  className={`w-full ${
                    isFormValid 
                      ? 'bg-yellow-400 hover:bg-yellow-500' 
                      : 'bg-gray-200 cursor-not-allowed'
                  } text-white font-medium py-2 px-4 rounded-lg transition-colors`}
                  disabled={loading || !isFormValid}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Submitting...</span>
                    </div>
                  ) : (
                    'Submit Feedback'
                  )}
                </Button>
              </motion.div>
            </AnimatePresence>

            {/* Form Status */}
            {!isFormValid && (
              <p className="text-sm text-gray-500 text-center">
                Please fill in all fields and provide a rating to submit your feedback
              </p>
            )}
          </form>
        </Card>
      </div>
    </motion.div>
  );
};

// Error Fallback Component
const ErrorFallback = ({ error, resetErrorBoundary }: ErrorFallbackProps) => {
    return (
      <div className="min-h-screen bg-gray-50/40 flex items-center justify-center p-4">
        <Card className="p-6 max-w-md w-full">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
            <p className="text-gray-600">{error.message}</p>
            <Button
              onClick={resetErrorBoundary}
              className="bg-yellow-400 hover:bg-yellow-500 text-white"
            >
              Try again
            </Button>
          </div>
        </Card>
      </div>
    );
  };

// Main Page Component
const FeedbackPage = () => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <FeedbackForm />
    </ErrorBoundary>
  );
};

export default FeedbackPage;