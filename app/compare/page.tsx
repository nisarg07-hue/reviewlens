"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ComparisonReport, CompareResponse } from "@/types";

export default function ComparePage() {
  const router = useRouter();
  const [isPro, setIsPro] = useState(false);
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState("");
  const [report, setReport] = useState<ComparisonReport | null>(null);

  useEffect(() => {
    const storedPlan = localStorage.getItem("reviewlens_plan_token");
    if (storedPlan !== "pro" && storedPlan !== "agency") {
      router.push("/?upgrade=compare");
    } else {
      setIsPro(true);
    }
  }, [router]);

  if (!isPro) {
    return (
      <main className="min-h-screen bg-[#0B0B0F] text-white flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-medium text-white mb-4">Pro Feature</h1>
          <p className="text-white/40 mb-6">Competitor comparison is available on Pro and Agency plans.</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2.5 rounded-lg bg-[#00C896] text-[#0B0B0F] text-sm font-medium"
          >
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault();
    if (!urlA.trim() || !urlB.trim()) return;

    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlA: urlA.trim(), urlB: urlB.trim() }),
      });

      const data: CompareResponse = await res.json();

      if (!data.success || !data.report) {
        setStatus("error");
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setReport(data.report);
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Network error — please try again.");
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0B0F] text-white flex flex-col">
      <header className="px-8 py-5 border-b border-white/5 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm"
        >
          <span>←</span> Back to home
        </button>
      </header>

      <div className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full space-y-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-medium text-white mb-3">Compare Competitors</h1>
          <p className="text-white/40 text-sm">See how two products stack up against each other based on customer reviews.</p>
        </div>

        {status !== "success" && (
          <form onSubmit={handleCompare} className="max-w-2xl mx-auto space-y-4">
            <div className="space-y-4">
              <input
                type="url"
                value={urlA}
                onChange={(e) => setUrlA(e.target.value)}
                placeholder="Product A URL (e.g. Trustpilot / Amazon / G2)"
                required
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00C896]/40 transition-colors"
                disabled={status === "loading"}
              />
              <div className="text-center text-white/20 text-xs font-medium">VS</div>
              <input
                type="url"
                value={urlB}
                onChange={(e) => setUrlB(e.target.value)}
                placeholder="Product B URL (e.g. Trustpilot / Amazon / G2)"
                required
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#F0A500]/40 transition-colors"
                disabled={status === "loading"}
              />
            </div>
            <button
              type="submit"
              disabled={status === "loading" || !urlA.trim() || !urlB.trim()}
              className="w-full mt-4 py-3 rounded-xl bg-[#00C896] text-[#0B0B0F] text-sm font-medium hover:bg-[#00D4A3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "loading" ? "Analyzing... (This takes about 60 seconds)" : "Compare Products"}
            </button>
            {status === "error" && <p className="text-red-400 text-xs text-center mt-2">{error}</p>}
          </form>
        )}

        {status === "success" && report && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-4 mb-4">
                <span className="px-3 py-1 rounded bg-white/5 border border-white/10 text-sm font-medium">{report.productA.name}</span>
                <span className="text-white/30 text-xs">vs</span>
                <span className="px-3 py-1 rounded bg-white/5 border border-white/10 text-sm font-medium">{report.productB.name}</span>
              </div>
              <p className="text-white/60 text-base leading-relaxed">{report.executiveSummary}</p>
            </div>

            <div className="p-6 rounded-xl border border-[#00C896]/20 bg-[#00C896]/5 text-center">
              <h2 className="text-xs uppercase tracking-widest text-[#00C896] mb-2">Overall Winner</h2>
              <p className="text-2xl font-medium text-white mb-2">{report.winner}</p>
              <p className="text-sm text-white/60 max-w-2xl mx-auto">{report.winRationale}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Product A */}
              <div className="space-y-6">
                <h3 className="text-xl font-medium text-center border-b border-white/10 pb-4">{report.productA.name}</h3>
                <div>
                  <h4 className="text-xs uppercase tracking-widest text-white/30 mb-3">Strengths</h4>
                  <ul className="space-y-2">
                    {report.productA.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-white/70 flex gap-2">
                        <span className="text-[#00C896]">✓</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-widest text-white/30 mb-3">Weaknesses</h4>
                  <ul className="space-y-2">
                    {report.productA.weaknesses.map((w, i) => (
                      <li key={i} className="text-sm text-white/70 flex gap-2">
                        <span className="text-[#FF5B5B]">✕</span> {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Product B */}
              <div className="space-y-6">
                <h3 className="text-xl font-medium text-center border-b border-white/10 pb-4">{report.productB.name}</h3>
                <div>
                  <h4 className="text-xs uppercase tracking-widest text-white/30 mb-3">Strengths</h4>
                  <ul className="space-y-2">
                    {report.productB.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-white/70 flex gap-2">
                        <span className="text-[#00C896]">✓</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs uppercase tracking-widest text-white/30 mb-3">Weaknesses</h4>
                  <ul className="space-y-2">
                    {report.productB.weaknesses.map((w, i) => (
                      <li key={i} className="text-sm text-white/70 flex gap-2">
                        <span className="text-[#FF5B5B]">✕</span> {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm uppercase tracking-widest text-white/40 mb-4 text-center">Feature Breakdown</h3>
              <div className="space-y-3">
                {report.featureComparison.map((feat, i) => (
                  <div key={i} className="flex flex-col md:flex-row items-center gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="md:w-1/4 font-medium text-sm text-white text-center md:text-left">{feat.feature}</div>
                    <div className="md:w-1/6 text-center">
                      <span className={`text-xs px-2 py-1 rounded ${feat.winner === 'Tie' ? 'bg-white/10 text-white/60' : 'bg-[#00C896]/10 text-[#00C896] border border-[#00C896]/20'}`}>
                        {feat.winner === 'Tie' ? 'Tie' : feat.winner} Wins
                      </span>
                    </div>
                    <div className="md:w-7/12 text-sm text-white/50 text-center md:text-left">{feat.rationale}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center pt-8 border-t border-white/10">
               <button
                  onClick={() => {
                    setReport(null);
                    setStatus("idle");
                    setUrlA("");
                    setUrlB("");
                  }}
                  className="text-xs text-white/40 hover:text-white/80 transition-colors"
                >
                  Run another comparison
                </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
