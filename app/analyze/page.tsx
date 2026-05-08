"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { AnalysisReport } from "@/types";
import { PdfExportButton } from "@/components/PdfExportButton";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toneColor(tone: AnalysisReport["toneSignal"]) {
  const map: Record<string, string> = {
    "very positive": "#00C896",
    "mixed positive": "#7DD4B0",
    neutral: "#888",
    "mixed negative": "#F0A500",
    "very negative": "#FF5B5B",
  };
  return map[tone] ?? "#888";
}

function platformLabel(p: string) {
  return { amazon: "Amazon", g2: "G2", trustpilot: "Trustpilot", google: "Google", yelp: "Yelp" }[p] ?? p;
}

function severityColor(s: string) {
  return { critical: "#FF5B5B", moderate: "#F0A500", minor: "#888" }[s] ?? "#888";
}

function priorityColor(p: string) {
  return { high: "#FF5B5B", medium: "#F0A500", low: "#00C896" }[p] ?? "#888";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0B0B0F] flex items-center justify-center">
          <LoadingDots />
        </main>
      }
    >
      <AnalyzeContent />
    </Suspense>
  );
}

function AnalyzeContent() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState("");
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const storedPlan = localStorage.getItem("reviewlens_plan_token");
    setIsPro(storedPlan === "pro" || storedPlan === "agency");

    if (!id) { router.push("/"); return; }
    const cached = sessionStorage.getItem(`report_${id}`);
    if (cached) {
      setReport(JSON.parse(cached));
    } else {
      setError("Report not found. Please run a new analysis.");
    }
  }, [id, router]);

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

  if (error) {
    return (
      <main className="min-h-screen bg-[#0B0B0F] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="text-[#00C896] text-sm hover:underline"
          >
            ← Back to home
          </button>
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="min-h-screen bg-[#0B0B0F] flex items-center justify-center">
        <LoadingDots />
      </main>
    );
  }

  const { sentiment } = report;

  return (
    <main className="min-h-screen bg-[#0B0B0F] text-white">
      {/* Header */}
      <header className="px-8 py-5 border-b border-white/5 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm"
        >
          <span>←</span> ReviewLens
        </button>
        <div className="flex items-center gap-3">
          <span
            className="text-xs px-2.5 py-1 rounded-full border"
            style={{ borderColor: toneColor(report.toneSignal) + "40", color: toneColor(report.toneSignal) }}
          >
            {report.toneSignal}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
            }}
            className="text-xs text-white/30 hover:text-white/60 border border-white/10 rounded px-2.5 py-1 transition-all"
          >
            Copy link
          </button>
          {isPro && <PdfExportButton />}
        </div>
      </header>

      <div id="report-content" className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        {/* Product header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-white/30 uppercase tracking-widest">
              {platformLabel(report.platform)}
            </span>
            <span className="text-white/10">·</span>
            <span className="text-xs text-white/30">
              {report.totalReviewsAnalyzed} reviews analyzed
            </span>
          </div>
          <h1 className="text-2xl font-medium text-white mb-3">{report.productName}</h1>
          <p className="text-white/50 text-sm leading-relaxed max-w-2xl">{report.overallSummary}</p>
        </div>

        {/* Sentiment grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Avg rating" value={`${report.averageRating}★`} />
          <StatCard label="Positive" value={`${sentiment.positive}%`} color="#00C896" />
          <StatCard label="Neutral" value={`${sentiment.neutral}%`} color="#888" />
          <StatCard label="Negative" value={`${sentiment.negative}%`} color="#FF5B5B" />
        </div>

        {/* Star distribution */}
        <Section title="Star distribution">
          <div className="space-y-2">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const pct = sentiment.starDistribution[star] ?? 0;
              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-xs text-white/30 w-6">{star}★</span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: star >= 4 ? "#00C896" : star === 3 ? "#888" : "#FF5B5B",
                      }}
                    />
                  </div>
                  <span className="text-xs text-white/30 w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Pain points */}
        <Section title="Pain points">
          <div className="space-y-3">
            {report.painPoints.map((p, i) => (
              <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h4 className="text-sm font-medium text-white">{p.theme}</h4>
                  <div className="flex gap-2 flex-shrink-0">
                    <Tag color={severityColor(p.severity)} label={p.severity} />
                    <Tag color="#555" label={p.frequency} />
                  </div>
                </div>
                <p className="text-xs text-white/40 mb-3 leading-relaxed">{p.description}</p>
                {p.exampleQuotes.map((q, j) => (
                  <blockquote
                    key={j}
                    className="text-xs text-white/30 border-l border-white/10 pl-3 mb-1 italic"
                  >
                    "{q}"
                  </blockquote>
                ))}
              </div>
            ))}
          </div>
        </Section>

        {/* Praises */}
        <Section title="What customers love">
          <div className="space-y-3">
            {report.praises.map((p, i) => (
              <div key={i} className="rounded-lg border border-[#00C896]/10 bg-[#00C896]/[0.03] p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h4 className="text-sm font-medium text-white">{p.theme}</h4>
                  <Tag color="#00C896" label={p.frequency} />
                </div>
                <p className="text-xs text-white/40 mb-3 leading-relaxed">{p.description}</p>
                {p.exampleQuotes.map((q, j) => (
                  <blockquote
                    key={j}
                    className="text-xs text-white/30 border-l border-[#00C896]/20 pl-3 mb-1 italic"
                  >
                    "{q}"
                  </blockquote>
                ))}
              </div>
            ))}
          </div>
        </Section>

        {/* Improvements */}
        <Section title="Suggested improvements">
          <div className="space-y-3">
            {report.improvements.map((imp, i) => (
              <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h4 className="text-sm font-medium text-white">{imp.title}</h4>
                  <Tag color={priorityColor(imp.priority)} label={`${imp.priority} priority`} />
                </div>
                <p className="text-xs text-white/40 mb-1 leading-relaxed">{imp.rationale}</p>
                <p className="text-xs text-[#00C896]/60 leading-relaxed">→ {imp.estimatedImpact}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Competitor gap */}
        {report.competitorGap && (
          <Section title="Competitor signal">
            <div className="rounded-lg border border-[#F0A500]/15 bg-[#F0A500]/[0.04] p-4">
              <p className="text-sm text-white/60 leading-relaxed">{report.competitorGap}</p>
            </div>
          </Section>
        )}

        {/* CTA */}
        {!isPro && (
          <div className="rounded-xl border border-white/8 p-6 text-center" data-html2canvas-ignore>
            <p className="text-white/40 text-sm mb-4">
              Want PDF export, competitor comparison, and unlimited reports?
            </p>
            <button 
              onClick={() => handleCheckout("1607145")}
              className="px-6 py-2.5 rounded-lg bg-[#00C896] text-[#0B0B0F] text-sm font-medium hover:bg-[#00D4A3] transition-colors"
            >
              Upgrade to Pro — $29/mo
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-widest text-white/25 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 p-4">
      <p className="text-xs text-white/30 mb-1">{label}</p>
      <p className="text-xl font-medium" style={{ color: color ?? "white" }}>
        {value}
      </p>
    </div>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded uppercase tracking-wide whitespace-nowrap"
      style={{ color, background: color + "18", border: `1px solid ${color}25` }}
    >
      {label}
    </span>
  );
}

function LoadingDots() {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#00C896] animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
