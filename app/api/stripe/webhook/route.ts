import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServer } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    if (!sig) throw new Error("No signature");
    // Webhook verification is temporarily disabled in dev if secret is empty
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body);
    }
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`[Stripe Webhook] Payment successful for session: ${session.id}`);
      
      if (session.client_reference_id) {
        const supabase = getSupabaseServer();
        const { error } = await supabase
          .from("users")
          .update({
            plan: "pro",
            stripe_customer_id: session.customer as string,
          })
          .eq("id", session.client_reference_id);
          
        if (error) {
          console.error("[Stripe Webhook] Error updating user:", error.message);
        } else {
          console.log(`[Stripe Webhook] Upgraded user ${session.client_reference_id} to Pro.`);
        }
      }
      break;
    default:
      console.log(`[Stripe Webhook] Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
