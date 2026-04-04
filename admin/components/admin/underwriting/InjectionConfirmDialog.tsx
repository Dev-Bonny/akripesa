'use client';

import { useState, useTransition } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { injectPlatformCapitalAction } from '@/actions/campaign.actions';
import { formatKes } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Props {
  campaignId: string;
  shortfallKes: number;       // cents
  commodityLabel: string;
  onSuccess: () => void;
}

/**
 * Inline confirmation — no modal needed for a destructive financial action.
 * Two-click pattern: first click reveals the confirmation UI,
 * second click fires the Server Action.
 * This prevents accidental injections from a mis-click on the table row.
 */
export const InjectionConfirmDialog = ({
  campaignId,
  shortfallKes,
  commodityLabel,
  onSuccess,
}: Props) => {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await injectPlatformCapitalAction(campaignId);
      if (result.success) {
        toast.success(
          `Platform injection of ${formatKes(result.injectedAmountKes ?? 0)} confirmed.`
        );
        setConfirming(false);
        onSuccess();
      } else {
        toast.error(result.message);
        setConfirming(false);
      }
    });
  };

  if (!confirming) {
    return (
      <Button
        size="sm"
        variant="warning"
        onClick={() => setConfirming(true)}
        className="gap-1.5"
      >
        <Zap className="h-3.5 w-3.5" />
        Inject Capital
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5">
      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
      <p className="text-xs text-amber-800">
        Draw <span className="font-bold">{formatKes(shortfallKes)}</span> from
        credit line for {commodityLabel}?
      </p>
      <Button
        size="sm"
        variant="warning"
        onClick={handleConfirm}
        loading={isPending}
        className="ml-1 h-7 text-xs"
      >
        Confirm
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setConfirming(false)}
        disabled={isPending}
        className="h-7 text-xs"
      >
        Cancel
      </Button>
    </div>
  );
};