import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type Tenant = {
  id: string;
  slug: string;
  name: string;
};

/**
 * RLS-scoped lookup: returns the tenant only if the caller is a member or
 * superadmin. Wrapped in `React.cache` so a layout and its child page can
 * both call this within one request without firing the query twice.
 */
export const getTenantBySlug = cache(async (slug: string): Promise<Tenant | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tenants')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle();
  return data;
});
