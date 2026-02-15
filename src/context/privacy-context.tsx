"use client";

/**
 * Privacy Context — blurs sensitive financial numbers.
 *
 * - Adds `data-blurred` attribute to <html> when active
 * - Auto-blurs after configurable inactivity (default 5 min)
 * - Toggle via keyboard shortcut (Ctrl+Shift+B) or nav button
 * - Persists preference in localStorage
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

const STORAGE_KEY = "nw-privacy-blurred";
const LAST_VISIT_KEY = "nw-last-visit";
const AUTO_BLUR_MS = 5 * 60 * 1000; // 5 minutes of inactivity
const STALE_VISIT_MS = 24 * 60 * 60 * 1000; // 24 hours since last visit

interface PrivacyContextValue {
  blurred: boolean;
  toggle: () => void;
  setBlurred: (value: boolean) => void;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  blurred: false,
  toggle: () => {},
  setBlurred: () => {},
});

export function usePrivacy() {
  return useContext(PrivacyContext);
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [blurred, setBlurredState] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialise from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
    const now = Date.now();

    // If not opened in a while, default to blurred
    if (lastVisit) {
      const elapsed = now - Number(lastVisit);
      if (elapsed > STALE_VISIT_MS) {
        setBlurredState(true);
        return;
      }
    }

    if (stored === "true") {
      setBlurredState(true);
    }

    // Record this visit
    localStorage.setItem(LAST_VISIT_KEY, String(now));
  }, []);

  // Sync to DOM and localStorage
  useEffect(() => {
    document.documentElement.setAttribute("data-blurred", String(blurred));
    localStorage.setItem(STORAGE_KEY, String(blurred));
  }, [blurred]);

  // Record visit time on unload
  useEffect(() => {
    const onUnload = () => {
      localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  // Auto-blur after inactivity
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setBlurredState(true);
    }, AUTO_BLUR_MS);
  }, []);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
    const onActivity = () => {
      resetTimer();
    };
    for (const event of events) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    resetTimer(); // Start the timer
    return () => {
      for (const event of events) {
        window.removeEventListener(event, onActivity);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  // Keyboard shortcut: Ctrl+Shift+B
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "B") {
        e.preventDefault();
        setBlurredState((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggle = useCallback(() => {
    setBlurredState((prev) => !prev);
  }, []);

  const setBlurred = useCallback((value: boolean) => {
    setBlurredState(value);
  }, []);

  return (
    <PrivacyContext.Provider value={{ blurred, toggle, setBlurred }}>
      {children}
    </PrivacyContext.Provider>
  );
}
