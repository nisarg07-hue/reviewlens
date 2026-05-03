"use client";

import { useState } from "react";
import { getClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setError("");

    const supabase = getClient();
    
    // Construct the redirect URL for the callback
    const redirectUrl = `${window.location.origin}/auth/callback`;

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (signInError) {
      setStatus("error");
      setError(signInError.message);
    } else {
      setStatus("success");
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0B0F] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="w-7 h-7 rounded-full border border-[#00C896]/60 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00C896]" />
          </div>
          <span className="text-white font-medium tracking-tight text-sm">ReviewLens</span>
        </div>

        <h1 className="text-white text-2xl font-medium text-center mb-2">Sign in</h1>
        <p className="text-white/40 text-sm text-center mb-8">
          Enter your email to receive a secure login link.
        </p>

        {status === "success" ? (
          <div className="p-4 rounded-xl border border-[#00C896]/20 bg-[#00C896]/5 text-center">
            <p className="text-[#00C896] text-sm font-medium mb-1">Check your email</p>
            <p className="text-white/60 text-xs">We sent a magic link to {email}</p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#00C896]/40 transition-colors"
                disabled={status === "loading"}
              />
            </div>

            <button
              type="submit"
              disabled={status === "loading" || !email.trim()}
              className="w-full py-3 rounded-xl bg-[#00C896] text-[#0B0B0F] text-sm font-medium hover:bg-[#00D4A3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "loading" ? "Sending..." : "Send Magic Link"}
            </button>

            {status === "error" && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}
          </form>
        )}
        
        <div className="mt-8 text-center">
          <a href="/" className="text-white/30 hover:text-white/60 text-xs transition-colors">
            ← Back to home
          </a>
        </div>
      </div>
    </main>
  );
}
