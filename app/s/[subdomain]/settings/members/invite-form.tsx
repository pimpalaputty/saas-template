'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inviteMemberAction, type ActionResult } from './actions';

const INITIAL: ActionResult = { status: 'idle' };

export function InviteForm({ subdomain }: { subdomain: string }) {
  const [state, action, isPending] = useActionState(inviteMemberAction, INITIAL);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="subdomain" value={subdomain} />
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="email" className="sr-only">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="teammate@company.com"
            disabled={isPending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="role" className="sr-only">Role</Label>
          <select
            id="role"
            name="role"
            defaultValue="member"
            disabled={isPending}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Sending…' : 'Invite'}
        </Button>
      </div>
      {state.status === 'error' && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state.status === 'success' && (
        <p className="text-sm text-green-600">{state.message}</p>
      )}
    </form>
  );
}
