'use client';

import { useFormState as useActionState } from 'react-dom';
import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { registerAction, AuthActionState } from '@/actions/auth.actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const initial: AuthActionState = { success: false, message: '' };

export default function RegisterPage() {
  const [state, action, isPending] = useActionState(registerAction, initial);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500">
            <Leaf className="h-6 w-6 text-brand-950" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
          <p className="text-sm text-muted-foreground">
            Start investing from KES 100
          </p>
        </div>

        {/* Error banner */}
        {!state.success && state.message && !state.fieldErrors && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.message}
          </div>
        )}

        <form action={action} className="space-y-4">
          <Input
            name="fullName"
            label="Full Name"
            placeholder="Jane Muthoni"
            autoComplete="name"
            error={state.fieldErrors?.fullName?.[0]}
          />
          <Input
            name="phoneNumber"
            label="M-Pesa Phone Number"
            placeholder="2547XXXXXXXX"
            inputMode="tel"
            error={state.fieldErrors?.phoneNumber?.[0]}
          />
          <Input
            name="email"
            label="Email (optional)"
            type="email"
            placeholder="jane@example.com"
            error={state.fieldErrors?.email?.[0]}
          />
          <Input
            name="password"
            label="Password"
            type="password"
            placeholder="Min. 8 chars, 1 uppercase, 1 number"
            error={state.fieldErrors?.password?.[0]}
          />

          <Button type="submit" className="w-full" size="lg" loading={isPending}>
            {isPending ? 'Creating account…' : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}