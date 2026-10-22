import { createClient } from '@/lib/supabase/server';

/** Contexte d'une Server Action : utilisateur vérifié par Supabase Auth à CHAQUE appel. */
export async function getActionContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}
