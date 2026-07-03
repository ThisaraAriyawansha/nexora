"use client";
import Lottie from "lottie-react";
import gamingAnimation from "@/public/loading/gaming.json";

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Lottie animationData={gamingAnimation} loop className="w-56 h-56" />
      <span className="font-milonga text-3xl text-black tracking-tight -mt-4">Nexora</span>
    </div>
  );
}
