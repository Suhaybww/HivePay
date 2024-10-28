import React from 'react';
import MaxWidthWrapper from './MaxWidthWrapper';
import Link from 'next/link';
import { Button } from './ui/button';
import Image from 'next/image';

const Introduction = () => {
  return (
    <section className="py-48">
      <MaxWidthWrapper>
        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* Content */}
          <div className="flex-1 space-y-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Modern Group Savings
              <span className="block mt-2 text-purple-600">Made Simple</span>
            </h2>

            <p className="text-gray-600 text-lg leading-relaxed">
              Roundly reinvents the traditional ROSCA (Rotating Savings and Credit Association) 
              with a seamless, digital platform. Enjoy an internet-free, peer-to-peer loan system, 
              allowing you to save and lend with your trusted circle, 
              without banks or intermediaries. Perfect for achieving financial goals together.
            </p>

            <Button
              size="lg"
              className="mt-2 bg-purple-500 text-white hover:bg-purple-700 transition-all"
              asChild
            >
              <Link href="/how-it-works">
                Create an Account
              </Link>
            </Button>
          </div>

          {/* Image */}
          <div className="flex-1">
            <div className="relative w-full h-0 pb-[52.63%] overflow-hidden rounded-2xl">
              <Image
                src="/images/1.jpg"
                alt="People managing their group savings"
                fill
                className="object-cover rounded-2xl"
                priority
                style={{
                  backgroundImage: `url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAAElBMVEUAAAD8/vz08vT09vT8+vzs7uxH16TeAAAAAXRSTlMAQObYZgAAAAlwSFlzAAAOxAAADsQBlSsOGwAAAuFJREFUOI0Vk+3NLiEIRG1B8ClAYAsQ2AIEt4D9ePtv5Xp/mZgYJ2fOFJKEfInkVWY2aglmQFkimRTV7MblYyVqD7HXyhKsSuPX12MeDhRHLtGvRG+P+B/S0Vu4OswR9tmvwNPyhdCDbVayJGads/WiUWcjCvCnruTBNHS9gmX2VzVbk7ZvB1gb1hkWFGl+A/n+/FowcO34U/XvKqZ/fHY+6vgRfU92XrOBUbGeeDfQmjWjdrK+frc6FdGReQhfSF5JvR29O2QrfNw1huTwlgsyXLo0u+5So82sgv7tsFZR2nxB6lXiquHrfD8nfYZ9SeT0LiuvSoVrxGY16pCNRZKqvwWsn5OHypPBELzohMCaRaa0ceTHYqe7X/gfJEEtKFbJpWoNqO+aS1cuTykGPpK5Ga48m6L3NefTr013KqYBQu929iP1oQ/7UwSR+i3zqruUmT84qmhzLpxyj7pr9kg7LKvqaXxZmdpn+6o8sHqSqojy02gU3U8q9PnpidiaLks0mbMYz+q2uVXsoBQ8bfURULYxRgZVYCHMv9F4OA7qxT2NPPpvGQ/sTDH2yznKh7E2AcErfcNsaIoN1izzbJiaY63x4QjUFdBSvDCvugPpu5xDny0jzEeuUQbcP1aGT9V90uixngTRLYNEIIZ6yOF1H8tm7rj2JxiefsVy53zGVy3ag5uuPsdufYOzYxLRxngKe7nhx3VAq54pmz/DK9/Q3aDam2Yt3hNXB4HuU87jKNd/CKZn77Qdn5QkXPfqSkhk7hGOXXB+7v09KbBbqdvxGqa0AqfK/atIrL2WXdAgXAJ43Wtwe/aIoacXezeGPMlhDOHDbSfHnaXsL2QzbT82GRwZuezdwcoWzx5pnOnGMUdHuiY7lhdyWzWiHnucLZQxYStMJbtcydHaQ6vtMbe0AcDbxG+QG14AL94xry4297xpy9Cpf1OoxZ740gHDfrK+gtsy0xabwJmfgtCeii79B6aj0SJeLbd7AAAAAElFTkSuQmCC)`,
                  backgroundSize: 'cover',
                  mixBlendMode: 'multiply',
                }}
              />
            </div>
          </div>
        </div>
      </MaxWidthWrapper>
    </section>
  );
};

export default Introduction;
