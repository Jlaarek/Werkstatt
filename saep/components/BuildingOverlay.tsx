"use client";

import { useState, useEffect } from "react";
import { BUILD_STEPS } from "@/lib/appGenerator";

type BuildingOverlayProps = {
  isBuilding: boolean;
  onComplete: () => void;
};

export function BuildingOverlay({ isBuilding, onComplete }: BuildingOverlayProps) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isBuilding) {
      setStep(0);
      setProgress(0);
      return;
    }

    const stepDuration = 800;
    const totalSteps = BUILD_STEPS.length;

    const interval = setInterval(() => {
      setStep((prev) => {
        const next = prev + 1;
        if (next >= totalSteps) {
          clearInterval(interval);
          setTimeout(onComplete, 400);
          return prev;
        }
        return next;
      });
      setProgress((prev) => Math.min(prev + 100 / totalSteps, 100));
    }, stepDuration);

    return () => clearInterval(interval);
  }, [isBuilding, onComplete]);

  if (!isBuilding) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="glass rounded-2xl p-8 max-w-md w-full mx-4 text-center animate-fade-in">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-saep-400 to-accent-500 flex items-center justify-center text-2xl font-bold animate-glow">
            Säp
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-2">App wird gebaut…</h3>
        <p className="text-text-secondary text-sm mb-6 transition-all duration-300">
          {BUILD_STEPS[step]}
        </p>

        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-saep-400 to-accent-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-center gap-2">
          <span className="building-dot w-2 h-2 rounded-full bg-saep-400" />
          <span className="building-dot w-2 h-2 rounded-full bg-saep-400" />
          <span className="building-dot w-2 h-2 rounded-full bg-saep-400" />
        </div>
      </div>
    </div>
  );
}
