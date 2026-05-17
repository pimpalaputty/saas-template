'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { slugify, validateSlug } from '@/lib/tenants/slug';
import { rootDomain } from '@/lib/utils';
import { startSignupAction, type SignupState } from './actions';

const INITIAL: SignupState = { status: 'idle' };

export function SignupForm() {
  const [state, action, isPending] = useActionState(startSignupAction, INITIAL);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const slugDirty = useRef(false);

  // Live slug suggestion — stops as soon as the user manually edits the slug.
  useEffect(() => {
    if (!slugDirty.current) setSlug(slugify(name));
  }, [name]);

  if (state.status === 'sent') {
    return (
      <div className="space-y-2 text-center">
        <h2 className="text-lg font-medium">Check your email</h2>
        <p className="text-sm text-gray-600">
          We sent a magic link to <strong>{state.email}</strong>. Click it to
          finish creating <strong>{slug}.{rootDomain}</strong>.
        </p>
      </div>
    );
  }

  const slugErr = slug ? validateSlug(slug) : null;

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Your email</Label>
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

      <div className="space-y-2">
        <Label htmlFor="name">Workspace name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          maxLength={60}
          placeholder="Acme Inc."
          disabled={isPending}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Subdomain</Label>
        <div className="flex items-center">
          <Input
            id="slug"
            name="slug"
            type="text"
            required
            maxLength={32}
            placeholder="acme"
            disabled={isPending}
            value={slug}
            onChange={(e) => {
              slugDirty.current = true;
              setSlug(e.target.value);
            }}
            className="rounded-r-none"
            aria-invalid={!!slugErr}
          />
          <span className="flex min-h-9 items-center rounded-r-md border border-l-0 border-input bg-gray-100 px-3 text-sm text-gray-500">
            .{rootDomain}
          </span>
        </div>
        {slugErr && <SlugError error={slugErr} />}
      </div>

      {state.status === 'error' && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isPending || !!slugErr || !name || !slug}
      >
        {isPending ? 'Sending magic link…' : 'Continue'}
      </Button>
    </form>
  );
}

function SlugError({ error }: { error: NonNullable<ReturnType<typeof validateSlug>> }) {
  const msg = {
    too_short: 'At least 3 characters.',
    too_long: '32 characters or fewer.',
    invalid_chars: 'Lowercase letters, numbers, hyphens. No leading/trailing hyphen.',
    reserved: 'Reserved — pick another.',
  }[error];
  return <p className="text-xs text-red-600">{msg}</p>;
}
