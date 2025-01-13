import React from "react";
import MaxWidthWrapper from "./MaxWidthWrapper";
import { RegisterLink } from "@kinde-oss/kinde-auth-nextjs/components";
import Image from "next/image";

const Introduction = () => {
  return (
    <section className="py-48">
      <MaxWidthWrapper>
        {/* 
          Use flex-col on small devices and flex-row on larger screens,
          center items vertically across all breakpoints 
        */}
        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* Content */}
          <div className="flex-1 space-y-6 text-center lg:text-left">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Modern Group Savings
              <span className="block mt-2 text-yellow-400">Made Simple</span>
            </h2>

            <p className="text-gray-600 text-lg leading-relaxed">
              HivePay reinvents the traditional ROSCA (Rotating Savings and Credit Association)
              with a seamless, digital platform. Enjoy an internet-free, peer-to-peer loan system,
              allowing you to save and lend with your trusted circle, without banks or intermediaries.
              Perfect for achieving financial goals together. All of this at{" "}
              <strong className="text-yellow-400">0% interest</strong>.
            </p>

            <div className="pt-4">
              <RegisterLink
                className="px-6 py-3 text-lg font-medium text-white bg-yellow-400 hover:bg-yellow-500 rounded-md transition-all"
              >
                Create an Account
              </RegisterLink>
            </div>
          </div>

          {/* Responsive Image */}
          <div className="flex-1 w-full">
            {/* 
              Remove the fixed aspect ratio so the entire illustration 
              (including their feet) is visible. 
            */}
            <div className="relative w-full h-[600px] rounded-2xl overflow-hidden">
              <Image
                src="/images/test.png"
                alt="People managing their group savings"
                fill
                className="object-contain rounded-2xl"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>
          </div>
        </div>
      </MaxWidthWrapper>
    </section>
  );
};

export default Introduction;
