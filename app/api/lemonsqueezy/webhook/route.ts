import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseServer } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature") || "";
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "";

    console.log("[Lemon Squeezy Webhook] Received request");
    console.log("[Lemon Squeezy Webhook] Signature exists:", !!signature);
    console.log("[Lemon Squeezy Webhook] Secret exists:", !!secret);

    // Verify signature
    const hmac = crypto.createHmac("sha256", secret);
    const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
    const signatureBuffer = Buffer.from(signature, "utf8");

    if (digest.length !== signatureBuffer.length || !crypto.timingSafeEqual(digest, signatureBuffer)) {
      console.error("[Lemon Squeezy Webhook] Invalid signature.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log("[Lemon Squeezy Webhook] Signature verified.");
    const payload = JSON.parse(rawBody);
    console.log("[Lemon Squeezy Webhook] Full Payload:", JSON.stringify(payload, null, 2));
    
    const eventName = payload.meta.event_name;
    console.log("[Lemon Squeezy Webhook] Event name:", eventName);
    const customData = payload.meta.custom_data || {};

    if (eventName === "order_created" || eventName === "subscription_created") {
      const email = payload.data.attributes.user_email;
      const variantId = payload.data.attributes.first_subscription_item?.variant_id 
                        || payload.data.attributes.first_order_item?.variant_id
                        || payload.data.attributes.variant_id; // Try multiple paths depending on payload structure
      
      const plan = (variantId === 1607145 || variantId === "1607145") ? "pro" : "agency";
      
      if (email) {
        const supabase = getSupabaseServer();
        
        // 1. Find the user in auth.users by email using the Admin API
        const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
        const authUser = authUsers?.find(u => u.email === email);

        if (authUser) {
          const userId = authUser.id;
          console.log(`[Lemon Squeezy Webhook] Found auth user: ${userId} for email: ${email}`);

          // 2. Upsert into public.users using the correct ID
          const { error } = await supabase
            .from("users")
            .upsert({ 
              id: userId, 
              email, 
              plan 
            }, { onConflict: 'id' });

          if (error) {
            console.error("[Lemon Squeezy Webhook] Error upserting user plan:", error.message);
          } else {
            console.log(`[Lemon Squeezy Webhook] Successfully updated user ${email} to ${plan} plan.`);
          }
        } else {
          // If the user doesn't exist in Auth yet, we can't insert into public.users due to FK constraint.
          // For now, we log this. In a real app, you might store this in a 'pending_upgrades' table.
          console.warn(`[Lemon Squeezy Webhook] Purchase received for ${email}, but no Auth user exists yet. Skipping DB insert.`);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Lemon Squeezy Webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
