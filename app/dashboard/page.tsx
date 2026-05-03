"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClient } from "@/utils/supabase/client";
import type { DbReport } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [reports, setReports] = useState<DbReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = getClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          router.push("/login");
          return;
        }

        // Fetch user plan
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("plan")
          .eq("id", session.user.id)
          .single();

        if (userError || !userData) {
          setError("Failed to load user data.");
          setLoading(false);
          return;
        }

        setPlan(userData.plan);

        if (userData.plan === "free") {
          setLoading(false);
          return;
        }

        // Fetch reports
        const { data: reportData, error: reportError } = await supabase
          .from("reports")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (reportError) {
          setError("Failed to load reports.");
        } else {
          setReports(reportData as DbReport[]);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0B0B0F] flex items-center justify-center">
        <LoadingDots />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0B0F] text-white">
      <header className="px-8 py-5 border-b border-white/5 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm"
        >
          <span>←</span> Back to home
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        <div>
          <h1 className="text-2xl font-medium text-white mb-3">Your Reports</h1>
          {plan === "free" ? (
            <div className="mt-4 p-4 rounded-xl border border-[#F0A500]/20 bg-[#F0A500]/5">
              <p className="text-[#F0A500] text-sm font-medium mb-1">Upgrade Required</p>
              <p className="text-white/60 text-xs mb-4">Report history is only available on the Pro plan.</p>
              <button
                onClick={() => router.push("/")}
                className="px-5 py-2.5 rounded-lg bg-[#00C896] text-[#0B0B0F] text-sm font-medium hover:bg-[#00D4A3] transition-colors"
              >
                Go to Pricing
              </button>
            </div>
          ) : error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : reports.length === 0 ? (
            <p className="text-white/40 text-sm">No reports generated yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map((report) => (
                <div key={report.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-4 flex flex-col justify-between hover:border-[#00C896]/40 transition-colors cursor-pointer" onClick={() => router.push(`/analyze?id=${report.id}`)}>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-white/30 uppercase tracking-widest">{report.platform}</span>
                    </div>
                    <h4 className="text-sm font-medium text-white mb-1 line-clamp-1">{report.product_name}</h4>
                    <p className="text-xs text-white/40 mb-4 line-clamp-2">{report.report_json?.overallSummary ?? "No summary available"}</p>
                  </div>
                  <div className="text-xs text-white/20">
                    {new Date(report.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
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
