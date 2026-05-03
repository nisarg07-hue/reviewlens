import { NextResponse } from "next/server";
import { lemonSqueezySetup, createCheckout } from "@lemonsqueezy/lemonsqueezy.js";

// Initialize the Lemon Squeezy SDK
lemonSqueezySetup({
  apiKey: process.env.LEMONSQUEEZY_API_KEY!,
  onError: (error) => console.error("Lemon Squeezy Error:", error),
});

export async function POST(req: Request) {
  try {
    const { variantId } = await req.json();

    if (!variantId) {
      return NextResponse.json({ error: "variantId is required" }, { status: 400 });
    }

    const storeId = process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID!;
    
    // Determine the plan string from variantId to send back on success redirect
    const planString = variantId === 1607145 || variantId === "1607145" ? "pro" : "agency";
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const { error, data } = await createCheckout(storeId, variantId, {
      checkoutOptions: {
        embed: false,
        media: false,
      },
      productOptions: {
        redirectUrl: `${origin}/?success=true&plan=${planString}`,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data?.data?.attributes?.url) {
      return NextResponse.json({ url: data.data.attributes.url });
    }

    return NextResponse.json({ error: "Could not create checkout URL" }, { status: 500 });
  } catch (err: any) {
    console.error("Checkout creation failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
