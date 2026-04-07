import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string;
  subValue?: string;
  icon: LucideIcon;
  accent?: 'brand' | 'growth' | 'neutral';
}

const ACCENT_MAP = {
  brand:   { card: 'border-brand-200',   icon: 'bg-brand-100 text-brand-700' },
  growth:  { card: 'border-growth-200',  icon: 'bg-growth-100 text-growth-700' },
  neutral: { card: 'border-border',      icon: 'bg-muted text-muted-foreground' },
};

export const PortfolioSummaryCard = ({
  label,
  value,
  subValue,
  icon: Icon,
  accent = 'neutral',
}: Props) => {
  const styles = ACCENT_MAP[accent];
  return (
    <Card className={cn('border-2', styles.card)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subValue && (
              <p className="text-xs text-muted-foreground">{subValue}</p>
            )}
          </div>
          <div className={cn('rounded-xl p-2.5', styles.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};