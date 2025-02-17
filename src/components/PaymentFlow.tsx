"use client";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { cn } from "../lib/utils";
import MaxWidthWrapper from "../components/MaxWidthWrapper";

const data = [
  {
    title: "Cycle Initiation",
    content: "The group admin starts the contribution cycle, and direct debits are scheduled for the next contribution date.",
    srcImage: "/images/start.png",
  },
  {
    title: "Funds Collection",
    content: "Contributions are direct debited from all members and securely held in Stripe's platform until validated.",
    srcImage: "/images/collect.png",
  },
  {
    title: "Payout Distribution",
    content: "After all contributions are confirmed, the total payout is sent to the next person in line via Stripe Connect.",
    srcImage: "/images/payout.png",
  },
  {
    title: "Repeat for All Members",
    content: "The cycle repeats on the next contribution date until all members receive their payouts.",
    srcImage: "/images/repeat.png",
  },
];

export function PaymentFlow() {
  const [featureOpen, setFeatureOpen] = useState<number>(0);
  const [timer, setTimer] = useState<number>(0);
  const [isInView, setIsInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      {
        threshold: 0.2, // Triggers when 20% of the section is visible
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isInView) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 10);
      }, 10);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isInView]);

  useEffect(() => {
    if (timer > 10000) {
      setFeatureOpen((prev) => (prev + 1) % data.length);
      setTimer(0);
    }
  }, [timer]);

  return (
    <section ref={sectionRef} className="w-full bg-white py-24">
      <MaxWidthWrapper>
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-black dark:text-white mb-4">
            How Payments Work on <span className="text-yellow-400">HivePay</span>
          </h2>
          <p className="text-xl text-gray-600">
            Transparent and secure payment processing for your group contributions.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-6">
            {data.map((item, index) => (
              <button
                className="w-full"
                key={item.title}
                onClick={() => {
                  setFeatureOpen(index);
                  setTimer(0);
                }}
                type="button"
              >
                <TextComponent
                  content={item.content}
                  isOpen={featureOpen === index}
                  loadingWidthPercent={featureOpen === index ? timer / 100 : 0}
                  number={index + 1}
                  title={item.title}
                />
              </button>
            ))}
          </div>

          <div className="h-full">
            <div className="relative h-96 w-full overflow-hidden rounded-lg md:h-[500px]">
              {data.map((item, index) => (
                <div
                  key={item.title}
                  className={cn(
                    "absolute h-[500px] w-full transform-gpu transition-all duration-300",
                    featureOpen === index ? "scale-100" : "scale-70",
                    featureOpen > index ? "translate-y-full" : ""
                  )}
                  style={{ zIndex: data.length - index }}
                >
                  <Image
                    src={item.srcImage}
                    alt={item.title}
                    fill
                    className="object-contain rounded-lg"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </MaxWidthWrapper>
    </section>
  );
}

function TextComponent({
  number,
  title,
  content,
  isOpen,
  loadingWidthPercent,
}: {
  number: number;
  title: string;
  content: string;
  isOpen: boolean;
  loadingWidthPercent?: number;
}) {
  return (
    <div
      className={cn(
        "transform-gpu rounded-lg border transition-all",
        isOpen
          ? "border-yellow-500/10 bg-gradient-to-b from-yellow-200/15 to-yellow-200/5 dark:border-yellow-500/15 dark:from-yellow-600/15 dark:to-yellow-600/5 dark:shadow-[2px_4px_25px_0px_rgba(248,248,248,0.06)_inset]"
          : "scale-90 border-transparent opacity-50 saturate-0"
      )}
    >
      <div className="flex w-full items-center gap-4 p-4">
        <p
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-yellow-500/20 text-yellow-600"
          )}
        >
          {number}
        </p>
        <h2
          className={cn(
            "text-left font-medium text-neutral-800 text-xl dark:text-neutral-200"
          )}
        >
          {title}
        </h2>
      </div>
      <div
        className={cn(
          "w-full transform-gpu overflow-hidden text-left text-neutral-600 transition-all duration-500 dark:text-neutral-400",
          isOpen ? "max-h-64" : "max-h-0"
        )}
      >
        <p className="p-4 text-lg">{content}</p>
        <div className="w-full px-4 pb-4">
          <div className="relative h-1 w-full overflow-hidden rounded-full">
            <div
              className="absolute top-0 left-0 h-1 bg-yellow-500"
              style={{ width: `${loadingWidthPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentFlow;