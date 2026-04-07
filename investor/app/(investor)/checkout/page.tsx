'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Smartphone, CheckCircle2, XCircle, ArrowLeft, Clock,
} from 'lucide-react';
import {
  pledgeInvestmentAction,
  fetchInvestmentStatus,
  PledgeActionState,
} from '@/actions/investment.actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FundingProgressBar } from '@/components/investor/FundingProgressBar';
import { formatKes, kesToCents } from '@/lib/utils';
import Link from 'next/link';

const initial: PledgeActionState = { success: false, message: '' };

// Poll every 3 seconds for up to 2 minutes
const POLL_INTERVAL_MS  = 3_000;
const POLL_TIMEOUT_MS   = 120_000;

type CheckoutStep = 'form' | 'waiting' | 'success' | 'failed';

export default function CheckoutPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const router = useRouter();

  const [step, setStep]               = useState<CheckoutStep>('form');
  const [amountKes, setAmountKes]     = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [timeLeft, setTimeLeft]       = useState(120);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, action, isPending] = useActionState(
    pledgeInvestmentAction,
    initial
  );

  // When pledge succeeds, start polling
  useEffect(() => {
    if (!state.success || !state.investmentId) return;
    setStep('waiting');
    startPolling(state.investmentId);
  }, [state.success, state.investmentId]);

  const startPolling = (investmentId: string) => {
    let elapsed = 0;
    setTimeLeft(POLL_TIMEOUT_MS / 1000);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);

    pollRef.current = setInterval(async () => {
      elapsed += POLL_INTERVAL_MS;

      const result = await fetchInvestmentStatus(investmentId);

      if (result?.status === 'CONFIRMED' || result?.status === 'LOCKED') {
        clearIntervals();
        setStep('success');
        return;
      }

      if (result?.status === 'FAILED') {
        clearIntervals();
        setStep('failed');
        return;
      }

      if (elapsed >= POLL_TIMEOUT_MS) {
        clearIntervals();
        setStep('failed');
      }
    }, POLL_INTERVAL_MS);
  };

  const clearIntervals = () => {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => () => clearIntervals(), []);

  const amountCents = kesToCents(Number(amountKes) || 0);

  // ── Form step ──────────────────────────────────────────────────────────────

  if (step === 'form') {
    return (
      <div className="mx-auto max-w-md space-y-6 animate-fade-in">
        <Link
          href={`/campaigns/${campaignId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to campaign
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Confirm Investment
          </h1>
          <p className="text-sm text-muted-foreground">
            Your M-Pesa will receive a payment prompt after submission.
          </p>
        </div>

        {!state.success && state.message && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.message}
          </div>
        )}

        <Card>
          <CardContent className="space-y-5 p-6">
            <form action={action} className="space-y-4">
              <input type="hidden" name="campaignId" value={campaignId} />

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Investment Amount (KES)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-4 flex items-center text-sm text-muted-foreground">
                    KES
                  </span>
                  <input
                    name="amountInvestedKes"
                    type="number"
                    min="100"
                    step="100"
                    placeholder="500"
                    value={amountKes}
                    onChange={(e) => setAmountKes(e.target.value)}
                    className="flex h-12 w-full rounded-lg border border-input bg-white pl-14 pr-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                  />
                </div>
                {state.fieldErrors?.amountInvestedKes && (
                  <p className="text-xs text-red-500">
                    {state.fieldErrors.amountInvestedKes[0]}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Minimum KES 100</p>
              </div>

              <Input
                name="phoneNumber"
                label="M-Pesa Phone Number"
                placeholder="2547XXXXXXXX"
                inputMode="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                error={state.fieldErrors?.phoneNumber?.[0]}
              />

              {/* Live profit preview */}
              {amountCents >= 10000 && (
                <div className="rounded-xl border border-growth-200 bg-growth-50 p-4 text-center">
                  <p className="text-xs text-growth-600">You will receive</p>
                  <p className="text-2xl font-bold text-growth-700">
                    {formatKes(amountCents)}
                  </p>
                  <p className="text-xs text-growth-600">
                    + profit via M-Pesa on settlement
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={isPending}
              >
                <Smartphone className="mr-2 h-4 w-4" />
                Send M-Pesa STK Push
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          By investing you agree to Akripesa&apos;s terms. Investments are
          not guaranteed. Do not invest money you cannot afford to lose.
        </p>
      </div>
    );
  }

  // ── Waiting step ───────────────────────────────────────────────────────────

  if (step === 'waiting') {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-6 py-20 text-center animate-fade-in">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-brand-200 opacity-60" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand-500">
            <Smartphone className="h-8 w-8 text-brand-950" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900">
            Check your phone
          </h2>
          <p className="text-muted-foreground">
            An M-Pesa payment request has been sent to{' '}
            <span className="font-semibold">{phoneNumber}</span>.
            Enter your M-Pesa PIN to confirm.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 animate-spin" />
          Waiting for confirmation · {timeLeft}s
        </div>
        <p className="text-xs text-muted-foreground">
          Did not receive the prompt?{' '}
          <button
            onClick={() => setStep('form')}
            className="text-brand-600 underline"
          >
            Go back and retry
          </button>
        </p>
      </div>
    );
  }

  // ── Success step ───────────────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-6 py-20 text-center animate-fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-growth-100">
          <CheckCircle2 className="h-10 w-10 text-growth-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">
            Investment Confirmed! 🎉
          </h2>
          <p className="text-muted-foreground">
            Your M-Pesa payment was received. Your investment is now in
            escrow and earning returns.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Button onClick={() => router.push('/portfolio')} size="lg">
            View My Portfolio
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/marketplace')}
            size="lg"
          >
            Invest in Another Campaign
          </Button>
        </div>
      </div>
    );
  }

  // ── Failed step ────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-6 py-20 text-center animate-fade-in">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
        <XCircle className="h-10 w-10 text-red-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-slate-900">Payment Not Confirmed</h2>
        <p className="text-muted-foreground">
          The M-Pesa payment was not confirmed within 2 minutes. This may
          happen if the prompt was dismissed or the PIN was entered
          incorrectly.
        </p>
      </div>
      <div className="flex w-full flex-col gap-3">
        <Button onClick={() => setStep('form')} size="lg">
          Try Again
        </Button>
        <Link href={`/campaigns/${campaignId}`} className="w-full">
          <Button variant="outline" size="lg" className="w-full">
            Back to Campaign
          </Button>
        </Link>
      </div>
    </div>
  );
}