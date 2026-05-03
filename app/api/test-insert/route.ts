import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const testEmail = `test-${Date.now()}@example.com`;
    
    console.log("[Supabase Test] Attempting to insert:", testEmail);
    
    const { data, error } = await supabase
      .from("users")
      .insert({ email: testEmail, plan: "free" })
      .select();

    if (error) {
      console.error("[Supabase Test] Insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, inserted: data });
  } catch (err: any) {
    console.error("[Supabase Test] Catch error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
