"use client"

import React, { useState } from "react";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/text-area";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

export default function ContactPage() {
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

    // Clear error when the user types
    if (errors[id as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [id]: "" }));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

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
      console.log("Form submitted successfully:", formData);
      alert("Your message has been sent successfully!");
      setFormData({ name: "", email: "", message: "" });
    }
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
                "mt-1 block w-full border border-gray-300 rounded-md",
                "focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 focus:outline-none",
                errors.name && "border-red-500"
              )}
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
                "mt-1 block w-full border border-gray-300 rounded-md",
                "focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 focus:outline-none",
                errors.email && "border-red-500"
              )}
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
                "mt-1 block w-full border border-gray-300 rounded-md",
                "focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 focus:outline-none",
                errors.message && "border-red-500"
              )}
            />
            {errors.message && <p className="text-red-500 text-sm mt-1">{errors.message}</p>}
          </div>

          {/* Submit Button */}
          <div className="text-center">
            <Button
              type="submit"
              className="px-6 py-2 bg-yellow-400 text-white font-semibold rounded-md hover:bg-yellow-500 focus:ring-2 focus:ring-yellow-400 focus:outline-none"
            >
              Submit
            </Button>
          </div>
        </form>

        <div className="mt-12 text-center text-sm text-gray-600">
          <p>
            Alternatively, email us at{" "}
            <a
              href="mailto:support@hivepay.com"
              className="text-yellow-400 hover:underline"
            >
              support@hivepayapp.com
            </a>.
          </p>
        </div>
      </section>
    </main>
  );
}
