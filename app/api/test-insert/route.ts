import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    // Build Supabase URL (auto-fix if missing protocol)
    let url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (url && !url.startsWith("http")) {
      url = `https://${url}.supabase.co`;
    }
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    console.log("[Test] Supabase URL:", url);
    console.log("[Test] Service key exists:", !!key);

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Step 1: List all auth users
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error("[Test] Error listing auth users:", authError.message);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const authUsers = authData?.users || [];
    console.log(`[Test] Found ${authUsers.length} auth users`);
    console.log("[Test] Auth users:", authUsers.map(u => ({ id: u.id, email: u.email })));

    // Step 2: List all rows in public.users
    const { data: publicUsers, error: publicError } = await supabase
      .from("users")
      .select("*");

    if (publicError) {
      console.error("[Test] Error reading public.users:", publicError.message);
    }

    console.log("[Test] public.users rows:", JSON.stringify(publicUsers));

    // Step 3: If there's at least one auth user, try upserting them to 'pro'
    if (authUsers.length > 0) {
      const testUser = authUsers[0];
      console.log(`[Test] Attempting upsert for: id=${testUser.id}, email=${testUser.email}, plan=pro`);

      const { data: upsertData, error: upsertError } = await supabase
        .from("users")
        .upsert(
          { id: testUser.id, email: testUser.email, plan: "pro" },
          { onConflict: "id" }
        )
        .select();

      if (upsertError) {
        console.error("[Test] Upsert error:", JSON.stringify(upsertError));
        return NextResponse.json({
          authUsers: authUsers.map(u => ({ id: u.id, email: u.email })),
          publicUsers,
          upsertError: upsertError.message,
        });
      }

      console.log("[Test] Upsert success:", JSON.stringify(upsertData));

      // Step 4: Verify
      const { data: verify } = await supabase
        .from("users")
        .select("*")
        .eq("id", testUser.id)
        .single();

      console.log("[Test] Verified row:", JSON.stringify(verify));

      return NextResponse.json({
        authUsers: authUsers.map(u => ({ id: u.id, email: u.email })),
        publicUsers,
        upsertResult: upsertData,
        verifiedRow: verify,
      });
    }

    return NextResponse.json({
      authUsers: authUsers.map(u => ({ id: u.id, email: u.email })),
      publicUsers,
      message: "No auth users found to test with",
    });
  } catch (err: any) {
    console.error("[Test] Catch error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
