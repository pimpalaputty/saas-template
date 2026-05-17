'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendMagicLinkAction, type LoginState } from './actions';

const INITIAL: LoginState = { status: 'idle' };

export function LoginForm({ next }: { next?: string }) {
  const [state, action, isPending] = useActionState(sendMagicLinkAction, INITIAL);

  if (state.status === 'success') {
    return (
      <div className="text-center space-y-2">
        <h2 className="text-lg font-medium">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a magic link to <strong>{state.email}</strong>. Click the link
          to finish signing in.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          placeholder="you@company.com"
          disabled={isPending}
        />
      </div>
      {state.status === 'error' && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Sending…' : 'Send magic link'}
      </Button>
    </form>
  );
}
