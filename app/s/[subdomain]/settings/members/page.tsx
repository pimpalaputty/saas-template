import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { requireRole } from '@/lib/auth/rbac';
import { getSessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getTenantBySlug } from '@/lib/tenants/queries';
import { rootDomain } from '@/lib/utils';
import {
  cancelInvitationAction,
  changeRoleAction,
  removeMemberAction,
} from './actions';
import { InviteForm } from './invite-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  return { title: `Members | ${subdomain}.${rootDomain}` };
}

type MemberRow = {
  user_id: string;
  role: 'admin' | 'member';
  email: string;
  is_self: boolean;
};

type InviteRow = {
  id: string;
  email: string;
  role: 'admin' | 'member';
  expires_at: string;
};

export default async function MembersPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const tenant = await getTenantBySlug(subdomain);
  if (!tenant) notFound();

  await requireRole(tenant.id, 'admin');
  const me = await getSessionUser();
  const supabase = await createClient();

  const [{ data: memberships }, { data: invites }] = await Promise.all([
    supabase
      .from('memberships')
      .select('user_id, role, profiles:profiles!inner(email)')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('invitations')
      .select('id, email, role, expires_at')
      .eq('tenant_id', tenant.id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
  ]);

  const members: MemberRow[] = (memberships ?? []).map((m) => ({
    user_id: m.user_id as string,
    role: m.role as 'admin' | 'member',
    email: (m.profiles as unknown as { email: string }).email,
    is_self: me?.id === m.user_id,
  }));

  const pending: InviteRow[] = (invites ?? []) as InviteRow[];
  const adminCount = members.filter((m) => m.role === 'admin').length;

  return (
    <div className="mx-auto max-w-[672px] px-4 py-12 font-sans">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Members</h1>
        <Link
          href={`/settings`}
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Settings
        </Link>
      </div>

      <section className="mb-8 rounded-[14px] border border-border bg-surface p-6 shadow-airbnb">
        <h2 className="mb-1 text-base font-semibold text-ink">Invite a teammate</h2>
        <p className="mb-4 text-sm text-muted">
          They'll receive a magic link to join {tenant.name}.
        </p>
        <InviteForm subdomain={tenant.slug} />
      </section>

      <section className="mb-8 rounded-[14px] border border-border bg-surface shadow-airbnb overflow-hidden">
        <div className="border-b border-border px-6 py-4 bg-canvas">
          <h2 className="text-base font-semibold text-ink">
            Members <span className="text-muted font-normal">({members.length})</span>
          </h2>
        </div>
        <ul className="divide-y divide-border">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 px-6 py-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">
                  {m.email}
                  {m.is_self && <span className="ml-2 text-xs font-normal text-muted">(you)</span>}
                </div>
                <div className="text-xs capitalize text-muted mt-0.5">{m.role}</div>
              </div>
              <div className="flex items-center gap-2">
                {!m.is_self && (
                  <form action={changeRoleAction}>
                    <input type="hidden" name="subdomain" value={tenant.slug} />
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <input
                      type="hidden"
                      name="role"
                      value={m.role === 'admin' ? 'member' : 'admin'}
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={m.role === 'admin' && adminCount <= 1}
                    >
                      {m.role === 'admin' ? 'Demote' : 'Promote'}
                    </Button>
                  </form>
                )}
                {!m.is_self && (
                  <form action={removeMemberAction}>
                    <input type="hidden" name="subdomain" value={tenant.slug} />
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={m.role === 'admin' && adminCount <= 1}
                    >
                      Remove
                    </Button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {pending.length > 0 && (
        <section className="rounded-[14px] border border-border bg-surface shadow-airbnb overflow-hidden">
          <div className="border-b border-border px-6 py-4 bg-canvas">
            <h2 className="text-base font-semibold text-ink">
              Pending invitations <span className="text-muted font-normal">({pending.length})</span>
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-6 py-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{p.email}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {p.role} · expires {new Date(p.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <form action={cancelInvitationAction}>
                  <input type="hidden" name="subdomain" value={tenant.slug} />
                  <input type="hidden" name="invitation_id" value={p.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Cancel
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
