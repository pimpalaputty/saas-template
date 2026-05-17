'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { acceptInvitationAction, type AcceptResult } from './actions';

const INITIAL: AcceptResult = { status: 'idle' };

export function AcceptForm({
  token,
  tenantName,
}: {
  token: string;
  tenantName: string;
}) {
  const [state, action, isPending] = useActionState(
    acceptInvitationAction,
    INITIAL,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Joining…' : `Join ${tenantName}`}
      </Button>
      {state.status === 'error' && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}
