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
        // Since we want to match by email and insert if it doesn't exist, we can check if it exists first.
        // Wait, supabase `upsert` requires a unique constraint, often on id. If id isn't known, we might need to query then update/insert.
        
        const { data: existingUser } = await supabase
          .from("users")
          .select("*")
          .eq("email", email)
          .single();

        if (existingUser) {
          const { error } = await supabase
            .from("users")
            .update({ plan })
            .eq("email", email);
            
          if (error) {
            console.error("[Lemon Squeezy Webhook] Error updating user plan:", error);
          } else {
            console.log(`[Lemon Squeezy Webhook] Updated user ${email} to ${plan} plan.`);
          }
        } else {
          const { error } = await supabase
            .from("users")
            .insert({ email, plan });
            
          if (error) {
            console.error("[Lemon Squeezy Webhook] Error inserting new user:", error);
          } else {
            console.log(`[Lemon Squeezy Webhook] Inserted new user ${email} with ${plan} plan.`);
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Lemon Squeezy Webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
