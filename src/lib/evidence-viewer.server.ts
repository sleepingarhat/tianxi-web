import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { loadUserTier } from './tier.server';

/** Optional authentication; a supplied invalid identity never becomes an anonymous privileged read. */
export async function evidenceViewerIsPro(): Promise<boolean> {
  const authorization = getRequest().headers.get('authorization');
  if (!authorization) return false;
  if (!authorization.startsWith('Bearer ')) throw new Error('會員身份未能核實');
  const token = authorization.slice(7);
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key || !token) throw new Error('會員身份未能核實');
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization }, fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set('apikey', key);
      return fetch(input, { ...init, headers });
    } },
  });
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims.sub) throw new Error('會員身份未能核實');
  return (await loadUserTier(client, data.claims.sub)).tier === 'pro';
}