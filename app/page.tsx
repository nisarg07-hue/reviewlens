"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AnalyzeResponse } from "@/types";

const EXAMPLE_URLS = [
  "https://www.trustpilot.com/review/notion.so",
  "https://www.g2.com/products/slack/reviews",
  "https://www.amazon.com/dp/B08N5WRWNW",
];

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "paywall">("idle");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState(""); // loading phase label
  const [isPro, setIsPro] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState(0);

  useEffect(() => {
    import("@/utils/supabase/client").then(({ getClient }) => {
      const supabase = getClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUserEmail(session.user.email ?? null);
        }
      });
      supabase.auth.onAuthStateChange((_event, session) => {
        setUserEmail(session?.user?.email ?? null);
      });
    });

    const storedPlan = localStorage.getItem("reviewlens_plan_token");
    setIsPro(storedPlan === "pro" || storedPlan === "agency");

    const search = new URLSearchParams(window.location.search);
    if (search.get("success") === "true") {
      const plan = search.get("plan") || "pro";
      localStorage.setItem("reviewlens_plan_token", plan);
      setIsPro(true);
      router.replace("/");
    }

    setUsageCount(parseInt(localStorage.getItem("reviewlens_usage_count") || "0", 10));
  }, [router]);

  async function handleCheckout(variantId: string = "1607145") {
    try {
      const res = await fetch("/api/lemonsqueezy/checkout", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout failed", err);
    }
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    let usageCount = parseInt(localStorage.getItem("reviewlens_usage_count") || "0", 10);
    if (!isPro && usageCount >= 3) {
      setStatus("paywall");
      return;
    }

    setStatus("loading");
    setError("");
    setPhase("Detecting platform...");

    try {
      setPhase("Fetching reviews...");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      setPhase("Running AI analysis...");
      const data: AnalyzeResponse = await res.json();

      if (!data.success || !data.report) {
        setStatus("error");
        setError(data.error ?? "Something went wrong.");
        return;
      }

      if (!isPro) {
        localStorage.setItem("reviewlens_usage_count", (usageCount + 1).toString());
      }

      // Store report in sessionStorage so /analyze page can read it without a DB lookup
      sessionStorage.setItem(`report_${data.report.id}`, JSON.stringify(data.report));
      router.push(`/analyze?id=${data.report.id}`);
    } catch {
      setStatus("error");
      setError("Network error — please try again.");
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0B0F] flex flex-col">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full border border-[#00C896]/60 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00C896]" />
          </div>
          <span className="text-white font-medium tracking-tight text-sm">ReviewLens</span>
        </div>
        <nav className="flex items-center gap-6 text-xs text-white/40">
          <a href="#" className="hover:text-white/70 transition-colors">Pricing</a>
          {isPro && (
            <a href="/compare" className="hover:text-white/70 transition-colors">Compare</a>
          )}
          {userEmail ? (
            <div className="flex items-center gap-4">
              <a href="/dashboard" className="hover:text-white/70 transition-colors">Dashboard</a>
              <span className="text-white/60">{userEmail}</span>
              <button
                onClick={async () => {
                  const { getClient } = await import("@/utils/supabase/client");
                  await getClient().auth.signOut();
                  setUserEmail(null);
                }}
                className="hover:text-white/70 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <a href="/login" className="hover:text-white/70 transition-colors">Sign in</a>
          )}
          {!isPro && (
            <button
              onClick={() => handleCheckout("1607145")}
              className="px-3 py-1.5 rounded border border-white/10 text-white/60 hover:border-white/20 hover:text-white/80 transition-all"
            >
              Get Pro
            </button>
          )}
        </nav>
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00C896] animate-pulse" />
          <span className="text-[#00C896] text-xs tracking-widest uppercase font-medium">
            AI review intelligence
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-white text-4xl sm:text-5xl font-medium tracking-tight text-center max-w-2xl leading-tight mb-5">
          Know exactly what customers{" "}
          <span className="text-[#00C896]">hate</span> and{" "}
          <span className="text-[#F0A500]">love</span>
        </h1>

        <p className="text-white/40 text-base text-center max-w-md mb-12 leading-relaxed">
          Paste any Amazon, G2, or Trustpilot URL. Get an AI report in 30 seconds —
          pain points, praises, competitor gaps, improvement suggestions.
        </p>

        {/* URL Input form */}
        <form onSubmit={handleAnalyze} className="w-full max-w-2xl">
          <div className="relative">
            <div
              className={`flex items-center rounded-xl border transition-all duration-200 ${
                status === "loading"
                  ? "border-[#00C896]/40 bg-[#00C896]/5"
                  : status === "error"
                  ? "border-red-500/40 bg-red-500/5"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 focus-within:border-[#00C896]/40"
              }`}
            >
              {/* Platform icon / spinner */}
              <div className="pl-4 pr-2 text-white/20">
                {status === "loading" ? (
                  <LoadingSpinner />
                ) : (
                  <LinkIcon />
                )}
              </div>

              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                placeholder="https://www.trustpilot.com/review/notion.so"
                disabled={status === "loading"}
                className="flex-1 bg-transparent py-4 text-white/80 text-sm placeholder:text-white/20 outline-none disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={status === "loading" || !url.trim()}
                className="m-2 px-5 py-2.5 rounded-lg bg-[#00C896] text-[#0B0B0F] text-sm font-medium hover:bg-[#00D4A3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {status === "loading" ? phase : "Analyze"}
              </button>
            </div>

            {/* Error / Paywall message */}
            {status === "error" && (
              <p className="mt-2 text-red-400 text-xs px-1">{error}</p>
            )}
            
            {status === "paywall" && (
              <div className="mt-4 p-4 rounded-xl border border-[#F0A500]/20 bg-[#F0A500]/5 text-center flex flex-col items-center">
                <p className="text-[#F0A500] text-sm font-medium mb-1">Free limit reached</p>
                <p className="text-white/60 text-xs mb-4">You've used your 3 free analyses. Upgrade to Pro for unlimited reports, PDF exports, and more.</p>
                <div className="flex gap-4">
                  <button
                    onClick={() => handleCheckout("1607145")}
                    className="px-5 py-2.5 rounded-lg bg-[#00C896] text-[#0B0B0F] text-sm font-medium hover:bg-[#00D4A3] transition-colors"
                  >
                    Upgrade to Pro — $29/mo
                  </button>
                  <button
                    onClick={() => handleCheckout("1607165")}
                    className="px-5 py-2.5 rounded-lg bg-[#F0A500] text-[#0B0B0F] text-sm font-medium hover:bg-[#FFB414] transition-colors"
                  >
                    Get Agency — $79/mo
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Example URLs */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="text-white/20 text-xs">Try:</span>
          {EXAMPLE_URLS.map((u) => {
            const label = u.replace(/https?:\/\/(www\.)?/, "").split("/").slice(0, 2).join("/");
            return (
              <button
                key={u}
                onClick={() => setUrl(u)}
                className="text-xs text-white/30 hover:text-white/60 border border-white/8 hover:border-white/15 rounded px-2.5 py-1 transition-all"
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Supported platforms */}
        <div className="mt-16 flex items-center gap-8">
          {["Amazon", "G2", "Trustpilot", "Google*", "Yelp*"].map((p) => (
            <span key={p} className="text-white/15 text-xs">
              {p}
            </span>
          ))}
        </div>
        <p className="text-white/10 text-xs mt-2">* coming soon</p>
      </div>

      {/* Pricing Section */}
      {!isPro && (
        <div className="w-full border-t border-white/5 bg-[#0B0B0F]/50 py-16 flex flex-col items-center">
          <h2 className="text-white text-2xl font-medium mb-8">Choose your plan</h2>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col items-center w-64">
              <h3 className="text-white/80 text-lg mb-2">Pro Plan</h3>
              <p className="text-white text-3xl font-medium mb-6">$29<span className="text-sm text-white/40">/mo</span></p>
              <button
                onClick={() => handleCheckout("1607145")}
                className="w-full py-2.5 rounded-lg bg-[#00C896]/10 text-[#00C896] border border-[#00C896]/30 hover:bg-[#00C896]/20 transition-colors text-sm font-medium"
              >
                Get Pro
              </button>
            </div>
            <div className="p-6 rounded-2xl border border-[#F0A500]/30 bg-[#F0A500]/5 flex flex-col items-center w-64">
              <h3 className="text-white/80 text-lg mb-2">Agency Plan</h3>
              <p className="text-white text-3xl font-medium mb-6">$79<span className="text-sm text-white/40">/mo</span></p>
              <button
                onClick={() => handleCheckout("1607165")}
                className="w-full py-2.5 rounded-lg bg-[#F0A500] text-[#0B0B0F] hover:bg-[#FFB414] transition-colors text-sm font-medium"
              >
                Get Agency
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="px-8 py-4 border-t border-white/5 flex items-center justify-between">
        <span className="text-white/15 text-xs">© 2026 ReviewLens</span>
        {!isPro && (
          <span className="text-white/40 text-xs">
            {usageCount}/3 free analyses used
          </span>
        )}
      </footer>
    </main>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M6.5 9.5L9.5 6.5M7 4.5L8.5 3C9.6 1.9 11.4 1.9 12.5 3C13.6 4.1 13.6 5.9 12.5 7L11 8.5M9 11.5L7.5 13C6.4 14.1 4.6 14.1 3.5 13C2.4 11.9 2.4 10.1 3.5 9L5 7.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      className="animate-spin text-[#00C896]"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="28"
        strokeDashoffset="10"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M8 2a6 6 0 016 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
