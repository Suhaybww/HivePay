"use client";

import React from "react";

export default function DebugClickWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={(e) => {
        console.log("**DEBUG** wrapper clicked:", e.target);
      }}
    >
      {children}
    </div>
  );
}
