import { useEffect, useState, useRef } from "react";
import "./SplashScreen.css";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [loadingStep, setLoadingStep] = useState("Initializing...");
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    const steps = [
      { message: "Initializing application...", duration: 500 },
      { message: "Loading configuration...", duration: 600 },
      { message: "Connecting to services...", duration: 700 },
      { message: "Preparing workspace...", duration: 500 },
      { message: "Ready!", duration: 300 },
    ];

    let currentStep = 0;
    let currentProgress = 0;

    const runSteps = () => {
      if (currentStep < steps.length) {
        const step = steps[currentStep];
        setLoadingStep(step.message);

        const progressIncrement = 100 / steps.length;
        currentProgress += progressIncrement;
        setProgress(currentProgress);

        setTimeout(() => {
          currentStep++;
          runSteps();
        }, step.duration);
      } else {
        // Start fade out animation
        setTimeout(() => {
          setFadeOut(true);
          // Call onComplete after fade animation finishes - but only once
          setTimeout(() => {
            if (!completedRef.current) {
              completedRef.current = true;
              onComplete();
            }
          }, 500);
        }, 300);
      }
    };

    runSteps();
  }, [onComplete]);

  return (
    <div className={`splash-screen ${fadeOut ? "fade-out" : ""}`}>
      <div className="splash-content">
        <div className="splash-logo-container">
          <img src="/splash-logo.svg" alt="SAFEQ Cloud" className="splash-logo" />
        </div>

        <h1 className="splash-title">SAFEQ Cloud User Manager</h1>
        <p className="splash-subtitle">Desktop Tool for User Management</p>

        <div className="splash-loading">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="loading-text">{loadingStep}</p>
        </div>

        <footer className="splash-footer">
          <p>Version {import.meta.env.PACKAGE_VERSION || "0.1.0"}</p>
        </footer>
      </div>
    </div>
  );
}
