"use client"

import React, { useState } from "react";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/text-area";
import { Button } from "@/src/components/ui/button";
import { useToast } from "@/src/components/ui/use-toast";
import { cn } from "@/src/lib/utils";

export default function ContactPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const [errors, setErrors] = useState({
    name: "",
    email: "",
    message: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));

    // Clear error when user types
    if (errors[id as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [id]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validate fields
    const newErrors = {
      name: formData.name.trim() === "" ? "Name is required." : "",
      email: !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)
        ? "Invalid email address."
        : "",
      message: formData.message.trim() === "" ? "Message is required." : "",
    };

    setErrors(newErrors);

    // Check if there are no errors
    const isValid = Object.values(newErrors).every((error) => error === "");

    if (isValid) {
      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        toast({
          title: "Message sent!",
          description: "We'll get back to you as soon as possible.",
        });

        setFormData({ name: "", email: "", message: "" });
      } catch (error) {
        toast({
          title: "Error sending message",
          description: "Please try again or email us directly.",
          variant: "destructive",
        });
      }
    }
    
    setIsSubmitting(false);
  };

  return (
    <main className="min-h-screen bg-white py-10">
      <section className="container mx-auto px-4 max-w-3xl">
        <h1 className="text-center text-4xl font-bold text-gray-800">Contact Us</h1>
        <p className="text-center text-lg text-gray-600 mt-2">
          Have questions? Reach out to us using the form below.
        </p>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your name"
              className={cn(
                "mt-1",
                errors.name && "border-red-500"
              )}
              disabled={isSubmitting}
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              className={cn(
                "mt-1",
                errors.email && "border-red-500"
              )}
              disabled={isSubmitting}
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          {/* Message Field */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700">
              Message
            </label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Type your message here..."
              rows={5}
              className={cn(
                "mt-1",
                errors.message && "border-red-500"
              )}
              disabled={isSubmitting}
            />
            {errors.message && <p className="text-red-500 text-sm mt-1">{errors.message}</p>}
          </div>

          {/* Submit Button */}
          <div className="text-center">
            <Button
              type="submit"
              className="bg-yellow-400 hover:bg-yellow-500"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Submit"}
            </Button>
          </div>
        </form>

        <div className="mt-12 text-center text-sm text-gray-600">
          <p>
            Alternatively, email us at{" "}
            <a
              href="mailto:support@hivepay.com.au"
              className="text-yellow-400 hover:underline"
            >
              support@hivepay.com.au
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}