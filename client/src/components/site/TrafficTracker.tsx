import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { useLocation } from "wouter";

const VISITOR_KEY = "haobao-anonymous-visitor";

function getVisitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function getDevice(): "desktop" | "mobile" | "tablet" {
  if (window.innerWidth <= 767) return "mobile";
  if (window.innerWidth <= 1100 && navigator.maxTouchPoints > 1) return "tablet";
  return "desktop";
}

export function TrafficTracker() {
  const [location] = useLocation();
  const record = trpc.analytics.record.useMutation();

  useEffect(() => {
    if (location.startsWith("/admin") || navigator.doNotTrack === "1") return;
    let referrerHost: string | null = null;
    try {
      const host = document.referrer ? new URL(document.referrer).hostname : null;
      referrerHost = host && host !== window.location.hostname ? host : null;
    } catch {
      referrerHost = null;
    }
    const timer = window.setTimeout(() => {
      record.mutate({ visitorId: getVisitorId(), path: location.split("?")[0] || "/", referrerHost, device: getDevice() });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [location]);

  return null;
}
