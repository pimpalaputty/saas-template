'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateTenantNameAction, type SettingsState } from './actions';

const INITIAL: SettingsState = { status: 'idle' };

export function SettingsForm({
  subdomain,
  initialName,
}: {
  subdomain: string;
  initialName: string;
}) {
  const [state, action, isPending] = useActionState(
    updateTenantNameAction,
    INITIAL,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="subdomain" value={subdomain} />
      <div className="space-y-2">
        <Label htmlFor="name">Workspace name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          maxLength={60}
          defaultValue={initialName}
          disabled={isPending}
        />
      </div>
      {state.status === 'error' && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state.status === 'success' && (
        <p className="text-sm text-green-600">Saved.</p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}
