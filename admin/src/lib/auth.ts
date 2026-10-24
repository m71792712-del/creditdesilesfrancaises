import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface AdminProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'user' | 'admin';
}

/** Utilisateur vérifié auprès de Supabase Auth (getUser, jamais getSession). */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Profil de l'utilisateur connecté, UNIQUEMENT s'il a le rôle admin. */
export const getAdminProfile = cache(async (): Promise<AdminProfile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('id,first_name,last_name,email,role').eq('id', user.id).maybeSingle();
  const profile = data as AdminProfile | null;
  return profile && profile.role === 'admin' ? profile : null;
});

/** À appeler en tête de CHAQUE page et CHAQUE action : redirige vers /login si ce n'est pas l'admin. */
export async function requireAdmin(): Promise<AdminProfile> {
  const admin = await getAdminProfile();
  if (!admin) redirect('/login?erreur=acces');
  return admin;
}
