'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { inviteMemberAction, type ActionResult } from './actions';

const INITIAL: ActionResult = { status: 'idle' };

export function InviteForm({ subdomain }: { subdomain: string }) {
  const [state, action, isPending] = useActionState(inviteMemberAction, INITIAL);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="subdomain" value={subdomain} />
      <div className="flex gap-2 items-center">
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
          <Select name="role" defaultValue="member" disabled={isPending}>
            <SelectTrigger id="role" className="w-full">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
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
