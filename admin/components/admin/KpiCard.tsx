import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'warning' | 'danger' | 'success';
}

const VARIANT_STYLES = {
  default: { card: '',                    icon: 'bg-slate-100 text-slate-600' },
  warning: { card: 'border-amber-200',    icon: 'bg-amber-100 text-amber-600' },
  danger:  { card: 'border-red-200',      icon: 'bg-red-100 text-red-600'    },
  success: { card: 'border-brand-200',    icon: 'bg-brand-100 text-brand-600' },
};

export const KpiCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
}: KpiCardProps) => {
  const styles = VARIANT_STYLES[variant];

  return (
    <Card className={cn('transition-shadow hover:shadow-md', styles.card)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            {subtitle && (
              <p className="text-xs text-slate-400">{subtitle}</p>
            )}
          </div>
          <div className={cn('rounded-lg p-2.5', styles.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};