import { supabase } from "../lib/supabase";

export async function trackFrontendEvent(
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {}
) {
  // Recupera utente loggato
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Recupera anche full_name dal profilo (puoi fare cache oppure query ogni volta)
  let full_name = "";
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  if (profile) full_name = profile.full_name;

  try {
    await supabase.from("frontend_audit_logs").insert([
      {
        user_id: user.id,
        full_name, // <-- aggiungi qui!
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
      }
    ]);
  } catch (err) {
    // log errore
  }
}
