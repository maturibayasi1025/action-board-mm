// This check can be removed
// it is just for tutorial purposes

export function checkSupabaseEnvVars() {
  const requiredVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error(
      "Missing required Supabase environment variables:",
      missingVars,
    );
    console.error("Please check your environment configuration.");
    return false;
  }

  return true;
}

export function checkServiceRoleKey() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Some server-side operations may not work.",
    );
    return false;
  }
  return true;
}
