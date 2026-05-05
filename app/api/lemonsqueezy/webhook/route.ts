import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// ─── Create a dedicated Supabase admin client for the webhook ─────────────────
// We build this inline so we can log the exact URL being used.
function getWebhookSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  console.log("[WEBHOOK-DEBUG] Supabase URL being used:", JSON.stringify(url));
  console.log("[WEBHOOK-DEBUG] Supabase service key exists:", !!key);
  console.log("[WEBHOOK-DEBUG] Supabase service key length:", key?.length ?? 0);

  // Auto-fix: if the URL is just a project ref (no protocol), build the full URL
  let finalUrl = url;
  if (url && !url.startsWith("http")) {
    finalUrl = `https://${url}.supabase.co`;
    console.log("[WEBHOOK-DEBUG] ⚠️ SUPABASE_URL was missing protocol! Auto-corrected to:", finalUrl);
  }

  return createClient(finalUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log("════════════════════════════════════════════════════════════");
  console.log("[WEBHOOK] ▶ Incoming request at", new Date().toISOString());
  console.log("════════════════════════════════════════════════════════════");

  try {
    // ── Step 1: Read raw body ───────────────────────────────────────────────
    const rawBody = await req.text();
    console.log("[WEBHOOK] Step 1 — Raw body length:", rawBody.length, "bytes");
    console.log("[WEBHOOK] Step 1 — Raw body (first 500 chars):", rawBody.substring(0, 500));

    // ── Step 2: Read headers & secrets ──────────────────────────────────────
    const signature = req.headers.get("x-signature") || "";
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "";

    console.log("[WEBHOOK] Step 2 — x-signature header present:", !!signature);
    console.log("[WEBHOOK] Step 2 — x-signature value:", signature.substring(0, 20) + "...");
    console.log("[WEBHOOK] Step 2 — LEMONSQUEEZY_WEBHOOK_SECRET present:", !!secret);
    console.log("[WEBHOOK] Step 2 — LEMONSQUEEZY_WEBHOOK_SECRET value:", JSON.stringify(secret.substring(0, 10)) + "...");

    if (secret === "your_webhook_secret_here" || secret === "") {
      console.error("[WEBHOOK] ❌ CRITICAL: LEMONSQUEEZY_WEBHOOK_SECRET is not configured! It's still the placeholder value.");
      console.error("[WEBHOOK] ❌ Go to Lemon Squeezy → Settings → Webhooks → copy the Signing Secret and set it in Vercel env vars.");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // ── Step 3: Verify HMAC signature ───────────────────────────────────────
    const hmac = crypto.createHmac("sha256", secret);
    const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
    const signatureBuffer = Buffer.from(signature, "utf8");

    console.log("[WEBHOOK] Step 3 — Computed HMAC digest:", digest.toString("utf8").substring(0, 20) + "...");
    console.log("[WEBHOOK] Step 3 — Received signature:  ", signature.substring(0, 20) + "...");
    console.log("[WEBHOOK] Step 3 — Digest length:", digest.length, "| Signature length:", signatureBuffer.length);

    const lengthMatch = digest.length === signatureBuffer.length;
    let signatureValid = false;

    if (lengthMatch) {
      signatureValid = crypto.timingSafeEqual(digest, signatureBuffer);
    }

    console.log("[WEBHOOK] Step 3 — Signature verified:", signatureValid ? "✅ TRUE" : "❌ FALSE");

    if (!signatureValid) {
      console.error("[WEBHOOK] ❌ Signature verification FAILED. Possible causes:");
      console.error("  1. LEMONSQUEEZY_WEBHOOK_SECRET in Vercel doesn't match the secret in Lemon Squeezy dashboard");
      console.error("  2. The webhook URL is wrong");
      console.error("  3. The payload was modified in transit");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // ── Step 4: Parse payload ───────────────────────────────────────────────
    const payload = JSON.parse(rawBody);
    console.log("[WEBHOOK] Step 4 — Parsed payload successfully");
    console.log("[WEBHOOK] Step 4 — Full payload:", JSON.stringify(payload, null, 2));

    const eventName = payload.meta?.event_name;
    const customData = payload.meta?.custom_data || {};
    console.log("[WEBHOOK] Step 4 — Event name:", eventName);
    console.log("[WEBHOOK] Step 4 — Custom data:", JSON.stringify(customData));

    // ── Step 5: Check event type ────────────────────────────────────────────
    if (eventName !== "order_created" && eventName !== "subscription_created") {
      console.log(`[WEBHOOK] Step 5 — Event "${eventName}" is not order_created or subscription_created. Ignoring.`);
      return NextResponse.json({ received: true, skipped: true });
    }

    console.log("[WEBHOOK] Step 5 — ✅ Event is relevant, processing...");

    // ── Step 6: Extract email ───────────────────────────────────────────────
    const email = payload.data?.attributes?.user_email;
    console.log("[WEBHOOK] Step 6 — Extracted email:", email);

    if (!email) {
      console.error("[WEBHOOK] ❌ No email found in payload.data.attributes.user_email");
      console.error("[WEBHOOK] Available attributes keys:", Object.keys(payload.data?.attributes || {}));
      return NextResponse.json({ error: "No email in payload" }, { status: 400 });
    }

    // ── Step 7: Extract variant_id ──────────────────────────────────────────
    const variantId =
      payload.data?.attributes?.variant_id ||
      payload.data?.attributes?.first_subscription_item?.variant_id ||
      payload.data?.attributes?.first_order_item?.variant_id;

    console.log("[WEBHOOK] Step 7 — payload.data.attributes.variant_id:", payload.data?.attributes?.variant_id);
    console.log("[WEBHOOK] Step 7 — first_subscription_item?.variant_id:", payload.data?.attributes?.first_subscription_item?.variant_id);
    console.log("[WEBHOOK] Step 7 — first_order_item?.variant_id:", payload.data?.attributes?.first_order_item?.variant_id);
    console.log("[WEBHOOK] Step 7 — Final resolved variantId:", variantId);
    console.log("[WEBHOOK] Step 7 — variantId type:", typeof variantId);

    // ── Step 8: Map to plan ─────────────────────────────────────────────────
    // Variant ID mapping: 1607145 → 'pro', 1607165 → 'agency'
    let plan = "free";
    const variantIdStr = variantId?.toString();
    if (variantIdStr === "1607145") {
      plan = "pro";
    } else if (variantIdStr === "1607165") {
      plan = "agency";
    }
    console.log(`[WEBHOOK] Step 8 — Mapped variantId "${variantId}" → plan "${plan}"`);

    // ── Step 9: Initialize Supabase ─────────────────────────────────────────
    console.log("[WEBHOOK] Step 9 — Creating Supabase admin client...");
    const supabase = getWebhookSupabase();

    // ── Step 10: Find user in auth.users ────────────────────────────────────
    console.log(`[WEBHOOK] Step 10 — Searching for user with email: ${email}`);
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error("[WEBHOOK] ❌ Step 10 — Error listing auth users:", authError.message);
      console.error("[WEBHOOK] ❌ Full auth error:", JSON.stringify(authError));
      return NextResponse.json({ error: "Failed to list auth users" }, { status: 500 });
    }

    const authUsers = authData?.users || [];
    console.log(`[WEBHOOK] Step 10 — Total auth users returned: ${authUsers.length}`);

    const matchingUser = authUsers.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!matchingUser) {
      console.error(`[WEBHOOK] ❌ Step 10 — No auth user found for email: ${email}`);
      console.log("[WEBHOOK] Step 10 — Auth user emails (first 10):", authUsers.slice(0, 10).map(u => u.email));

      // Fallback: try inserting directly with email as identifier
      console.log("[WEBHOOK] Step 10 — Attempting fallback: upsert by email without auth user...");
      const { data: upsertData, error: upsertError } = await supabase
        .from("users")
        .upsert({ email, plan }, { onConflict: "email" })
        .select();

      if (upsertError) {
        console.error("[WEBHOOK] ❌ Fallback upsert also failed:", upsertError.message);
        console.error("[WEBHOOK] ❌ Full error:", JSON.stringify(upsertError));
      } else {
        console.log("[WEBHOOK] ✅ Fallback upsert by email succeeded:", JSON.stringify(upsertData));
      }

      return NextResponse.json({ received: true, fallback: !upsertError });
    }

    const userId = matchingUser.id;
    console.log(`[WEBHOOK] Step 10 — ✅ Found auth user: id=${userId}, email=${matchingUser.email}`);

    // ── Step 11: Upsert into public.users ───────────────────────────────────
    const upsertPayload = { id: userId, email, plan };
    console.log("[WEBHOOK] Step 11 — Upsert payload:", JSON.stringify(upsertPayload));
    console.log("[WEBHOOK] Step 11 — SQL equivalent: INSERT INTO users (id, email, plan) VALUES ('" + userId + "', '" + email + "', '" + plan + "') ON CONFLICT (id) DO UPDATE SET email='" + email + "', plan='" + plan + "'");

    const { data: upsertResult, error: upsertError } = await supabase
      .from("users")
      .upsert(upsertPayload, { onConflict: "id" })
      .select();

    if (upsertError) {
      console.error("[WEBHOOK] ❌ Step 11 — Upsert FAILED:", upsertError.message);
      console.error("[WEBHOOK] ❌ Step 11 — Full error:", JSON.stringify(upsertError));
      console.error("[WEBHOOK] ❌ Step 11 — Error code:", upsertError.code);
      console.error("[WEBHOOK] ❌ Step 11 — Error details:", upsertError.details);
      console.error("[WEBHOOK] ❌ Step 11 — Error hint:", upsertError.hint);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    console.log("[WEBHOOK] Step 11 — ✅ Upsert SUCCESS! Result:", JSON.stringify(upsertResult));

    // ── Step 12: Verify the update ──────────────────────────────────────────
    const { data: verifyData, error: verifyError } = await supabase
      .from("users")
      .select("id, email, plan")
      .eq("id", userId)
      .single();

    if (verifyError) {
      console.error("[WEBHOOK] Step 12 — Verification read failed:", verifyError.message);
    } else {
      console.log("[WEBHOOK] Step 12 — ✅ Verification read - current DB state:", JSON.stringify(verifyData));
      console.log("[WEBHOOK] Step 12 — Plan in DB is now:", verifyData?.plan);
    }

    const elapsed = Date.now() - startTime;
    console.log("════════════════════════════════════════════════════════════");
    console.log(`[WEBHOOK] ✅ COMPLETE — Updated ${email} to "${plan}" in ${elapsed}ms`);
    console.log("════════════════════════════════════════════════════════════");

    return NextResponse.json({ received: true, updated: true, plan });
  } catch (err: any) {
    console.error("════════════════════════════════════════════════════════════");
    console.error("[WEBHOOK] ❌ UNCAUGHT ERROR:", err.message);
    console.error("[WEBHOOK] Stack:", err.stack);
    console.error("════════════════════════════════════════════════════════════");
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
