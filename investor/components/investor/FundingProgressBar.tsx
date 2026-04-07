import { cn } from '@/lib/utils';

interface Props {
  percent: number;
  currentKes: number;
  targetKes: number;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' };

export const FundingProgressBar = ({
  percent,
  currentKes,
  targetKes,
  showLabels = false,
  size = 'md',
}: Props) => {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const isAlmostFull = clamped >= 80;

  return (
    <div className="w-full space-y-1.5">
      {showLabels && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">
              KES {(currentKes / 100).toLocaleString()}
            </span>{' '}
            raised
          </span>
          <span className={cn('font-bold', isAlmostFull ? 'text-growth-600' : 'text-brand-600')}>
            {clamped.toFixed(1)}%
          </span>
        </div>
      )}
      <div className={cn('w-full overflow-hidden rounded-full bg-muted', SIZE_MAP[size])}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            clamped >= 100
              ? 'bg-growth-500'
              : isAlmostFull
              ? 'bg-brand-400'
              : 'bg-brand-300'
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabels && (
        <p className="text-right text-xs text-muted-foreground">
          Goal: KES {(targetKes / 100).toLocaleString()}
        </p>
      )}
    </div>
  );
};