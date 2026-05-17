import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth/session';
import { hashInviteToken } from '@/lib/invitations/tokens';
import { protocol, rootDomain } from '@/lib/utils';
import { AcceptForm } from './accept-form';

export const metadata: Metadata = {
  title: `Accept invitation | ${rootDomain}`,
};

type InvitationLookup = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  email: string;
  role: 'admin' | 'member';
  expires_at: string;
  accepted_at: string | null;
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_invitation_by_hash', {
    p_hash: hashInviteToken(token),
  });

  const invitation = (Array.isArray(data) ? data[0] : null) as InvitationLookup | null;
  const user = await getSessionUser();

  if (error || !invitation) {
    return (
      <CenteredCard title="Invitation not found">
        <p className="text-sm text-muted">
          This invitation link is invalid or has been revoked.
        </p>
        <BackHome />
      </CenteredCard>
    );
  }

  if (invitation.accepted_at) {
    return (
      <CenteredCard title="Already accepted">
        <p className="text-sm text-muted">
          This invitation has already been used.
        </p>
        <BackHome />
      </CenteredCard>
    );
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <CenteredCard title="Invitation expired">
        <p className="text-sm text-muted">
          Ask an admin of <strong>{invitation.tenant_name}</strong> for a new link.
        </p>
        <BackHome />
      </CenteredCard>
    );
  }

  if (!user) {
    const next = `${protocol}://${rootDomain}/invite/${token}`;
    return (
      <CenteredCard title={`Join ${invitation.tenant_name}`}>
        <p className="text-sm text-muted">
          Sign in with <strong>{invitation.email}</strong> to accept this invitation.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="inline-flex h-12 items-center justify-center rounded-[8px] bg-primary px-6 text-base font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign in
        </Link>
      </CenteredCard>
    );
  }

  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <CenteredCard title="Email mismatch">
        <p className="text-sm text-muted">
          This invitation was sent to <strong>{invitation.email}</strong>, but
          you're signed in as <strong>{user.email}</strong>. Sign out and try
          again with the correct email.
        </p>
        <BackHome />
      </CenteredCard>
    );
  }

  return (
    <CenteredCard title={`Join ${invitation.tenant_name}`}>
      <p className="text-sm text-muted">
        You've been invited to join <strong>{invitation.tenant_name}</strong> as a{' '}
        <strong>{invitation.role}</strong>.
      </p>
      <AcceptForm token={token} tenantName={invitation.tenant_name} />
    </CenteredCard>
  );
}

function CenteredCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4 font-sans text-ink">
      <div className="w-full max-w-[448px] space-y-4 rounded-[14px] bg-surface p-6 shadow-airbnb border border-border">
        <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
        {children}
      </div>
    </div>
  );
}

function BackHome() {
  return (
    <Link href="/" className="inline-block text-sm font-medium text-primary hover:underline">
      ← Back to {rootDomain}
    </Link>
  );
}
