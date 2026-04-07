'use client';

import { useFormState as useActionState } from 'react-dom';
import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { loginAction, AuthActionState } from '@/actions/auth.actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const initial: AuthActionState = { success: false, message: '' };

export default function LoginPage() {
  const [state, action, isPending] = useActionState(loginAction, initial);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500">
            <Leaf className="h-6 w-6 text-brand-950" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your investor account
          </p>
        </div>

        {!state.success && state.message && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.message}
          </div>
        )}

        <form action={action} className="space-y-4">
          <Input
            name="phoneNumber"
            label="Phone Number"
            placeholder="2547XXXXXXXX"
            inputMode="tel"
            autoComplete="tel"
            error={state.fieldErrors?.phoneNumber?.[0]}
          />
          <Input
            name="password"
            label="Password"
            type="password"
            placeholder="Your password"
            autoComplete="current-password"
            error={state.fieldErrors?.password?.[0]}
          />

          <Button type="submit" className="w-full" size="lg" loading={isPending}>
            {isPending ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          New to Akripesa?{' '}
          <Link href="/register" className="font-medium text-brand-600 hover:underline">
            Create a free account
          </Link>
        </p>
      </div>
    </div>
  );
}