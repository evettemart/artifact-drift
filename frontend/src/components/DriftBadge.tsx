import { getSeverityColor } from '../lib/utils';

interface DriftBadgeProps {
  severity: string;
  className?: string;
}

export function DriftBadge({ severity, className = '' }: DriftBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(
        severity
      )} ${className}`}
    >
      {severity.toUpperCase()}
    </span>
  );
}

interface DriftTypeBadgeProps {
  type: string;
  className?: string;
}

export function DriftTypeBadge({ type, className = '' }: DriftTypeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800 ${className}`}
    >
      {type.replace(/_/g, ' ')}
    </span>
  );
}
