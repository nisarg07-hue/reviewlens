import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerClient } from "@/utils/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin") || "http://localhost:3000";

    const supabase = getServerClient();
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const userId = authSession?.user?.id;
    const userEmail = authSession?.user?.email;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      client_reference_id: userId,
      customer_email: userEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "ReviewLens Pro",
              description: "Unlimited AI review analyses, PDF exports, and history.",
            },
            unit_amount: 2900, // $29.00
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/?success=true`,
      cancel_url: `${origin}/?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe Checkout Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
