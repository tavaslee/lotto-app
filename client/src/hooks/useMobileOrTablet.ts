import { useEffect, useState } from "react";

export type DeviceSignals = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  coarsePointer: boolean;
  viewportWidth: number;
};

export function detectMobileOrTablet(signals: DeviceSignals) {
  const mobileOrTabletUa = /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(signals.userAgent);
  const iPadDesktopUa = signals.platform === "MacIntel" && signals.maxTouchPoints > 1;
  const touchViewport = signals.coarsePointer && signals.maxTouchPoints > 0 && signals.viewportWidth <= 1180;
  const compactViewport = signals.viewportWidth <= 1180;
  return mobileOrTabletUa || iPadDesktopUa || touchViewport || compactViewport;
}

function readDeviceSignals(): DeviceSignals {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    coarsePointer: window.matchMedia?.("(pointer: coarse)").matches ?? false,
    viewportWidth: window.innerWidth,
  };
}

export function useMobileOrTablet() {
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(() => detectMobileOrTablet(readDeviceSignals()));

  useEffect(() => {
    const update = () => setIsMobileOrTablet(detectMobileOrTablet(readDeviceSignals()));
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isMobileOrTablet;
}
