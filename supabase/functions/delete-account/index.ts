import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return respond({ error: "Sign in to delete your account." }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return respond({ error: "Sign in to delete your account." }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Bound the work per request so very large accounts can resume cleanup.
    for (let batch = 0; batch < 20; batch += 1) {
      const { data, error } = await admin.rpc("account_upload_cleanup_batch", { account_id: user.id });
      if (error) throw error;
      const objects = data as { bucket_id: string; object_name: string }[];
      if (!objects.length) {
        const { error: deleteError } = await userClient.rpc("delete_own_account");
        if (deleteError) throw deleteError;
        return respond({ deleted: true });
      }

      const pathsByBucket = new Map<string, string[]>();
      for (const { bucket_id, object_name } of objects) {
        const paths = pathsByBucket.get(bucket_id) ?? [];
        paths.push(object_name);
        pathsByBucket.set(bucket_id, paths);
      }
      for (const [bucket, paths] of pathsByBucket) {
        const { error: removeError } = await admin.storage.from(bucket).remove(paths);
        if (removeError) throw removeError;
      }
    }
    return respond({ error: "Upload cleanup is still in progress. Try deleting your account again." }, 503);
  } catch (error) {
    console.error("Account deletion failed", error instanceof Error ? error.name : "service error");
    return respond({ error: "Account deletion could not finish. Try again or contact FamOS support." }, 503);
  }
});
