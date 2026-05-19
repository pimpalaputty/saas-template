'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { slugify, validateSlug } from '@/lib/tenants/slug';
import { rootDomain } from '@/lib/utils';
import { startSignupAction, checkSlugAvailableAction, type SignupState } from './actions';
import { Loader2 } from 'lucide-react';

const INITIAL: SignupState = { status: 'idle' };

export function SignupForm() {
  const [state, action, isPending] = useActionState(startSignupAction, INITIAL);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [isSlugTaken, setIsSlugTaken] = useState(false);
  const slugDirty = useRef(false);

  // Debounced slug check. Async work that can't run synchronously in a handler
  // belongs in an effect; the slug derivation from `name` does not (see the
  // name input's onChange below).
  useEffect(() => {
    const s = slug.trim();
    if (!s || validateSlug(s)) {
      setIsSlugTaken(false);
      setIsCheckingSlug(false);
      return;
    }

    setIsCheckingSlug(true);
    setIsSlugTaken(false);

    const timer = setTimeout(async () => {
      try {
        const available = await checkSlugAvailableAction(s);
        setIsSlugTaken(!available);
      } catch {
        setIsSlugTaken(false);
      } finally {
        setIsCheckingSlug(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [slug]);

  if (state.status === 'sent') {
    return (
      <div className="space-y-2 text-center">
        <h2 className="text-lg font-medium text-ink">Check your email</h2>
        <p className="text-sm text-muted">
          We sent a magic link to <strong>{state.email}</strong>. Click it to
          finish creating <strong className="text-ink">{slug}.{rootDomain}</strong>.
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
          onChange={(e) => {
            const newName = e.target.value;
            setName(newName);
            // Derive the slug here rather than in a `useEffect([name])`. The
            // derivation is a pure sync transformation of the value the user
            // just typed — running it in the same handler avoids an extra
            // render cycle.
            if (!slugDirty.current) setSlug(slugify(newName));
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Subdomain</Label>
        <div className="flex items-center">
          <div className="relative flex-1 flex items-center">
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
              className="rounded-r-none pr-10 w-full"
              aria-invalid={!!slugErr || isSlugTaken}
            />
            {isCheckingSlug && (
              <div className="absolute right-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted" />
              </div>
            )}
          </div>
          <span className="flex h-14 items-center rounded-r-[8px] border border-l-0 border-input bg-surface-soft px-3 text-base text-muted shadow-sm">
            .{rootDomain}
          </span>
        </div>
        {slugErr ? (
          <SlugError error={slugErr} />
        ) : isSlugTaken ? (
          <p className="text-xs text-red-600">That subdomain is already taken.</p>
        ) : null}
      </div>

      {state.status === 'error' && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isPending || !!slugErr || isSlugTaken || isCheckingSlug || !name || !slug}
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
