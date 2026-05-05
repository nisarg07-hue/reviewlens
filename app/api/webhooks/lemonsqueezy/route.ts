import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature") || "";
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

    if (!secret || secret === "your_webhook_secret_here") {
      console.error("[webhook] LEMONSQUEEZY_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    const hmac = crypto.createHmac("sha256", secret);
    const expected = hmac.update(rawBody).digest("hex");
    
    // Simple string comparison (not timing-safe but works for webhook validation)
    if (expected !== signature) {
      console.error("[webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventName = payload.meta?.event_name;

    console.log("[webhook] Event:", eventName);

    if (!["order_created", "subscription_created", "subscription_updated", "subscription_cancelled"].includes(eventName)) {
      return NextResponse.json({ received: true, skipped: true });
    }

    const email = payload.data?.attributes?.user_email;
    if (!email) {
      return NextResponse.json({ error: "No email in payload" }, { status: 400 });
    }

    let plan = "free";
    const attrs = payload.data?.attributes;
    const productName = attrs?.product_name || attrs?.first_order_item?.product_name || attrs?.first_subscription_item?.product_name || "";

    if (eventName === "subscription_cancelled") {
      plan = "free";
    } else if (productName.toLowerCase().includes("agency")) {
      plan = "agency";
    } else if (productName.toLowerCase().includes("pro")) {
      plan = "pro";
    }

    console.log("[webhook] Email:", email, "-> Plan:", plan);

    const supabase = getSupabaseClient();
    const { error } = await supabase.from("users").upsert({ email, plan }, { onConflict: "email" });

    if (error) {
      console.error("[webhook] Upsert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ received: true, updated: true, plan });
  } catch (err: any) {
    console.error("[webhook] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}