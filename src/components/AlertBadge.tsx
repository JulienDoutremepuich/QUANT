import React from 'react';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';

type AlertSeverity = 'high' | 'medium' | 'low';

interface AlertBadgeProps {
  severity: AlertSeverity;
  message: string;
  count?: number;
  className?: string;
}

const AlertBadge: React.FC<AlertBadgeProps> = ({ severity, message, count, className = '' }) => {
  const getSeverityConfig = (severity: AlertSeverity) => {
    switch (severity) {
      case 'high':
        return {
          icon: AlertTriangle,
          color: 'bg-red-100 text-red-800 border-red-200',
        };
      case 'medium':
        return {
          icon: Clock,
          color: 'bg-orange-100 text-orange-800 border-orange-200',
        };
      case 'low':
        return {
          icon: CheckCircle,
          color: 'bg-green-100 text-green-800 border-green-200',
        };
    }
  };

  const config = getSeverityConfig(severity);
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 p-4 rounded-lg border ${config.color} ${className}`}>
      <Icon className="w-5 h-5" />
      <span className="font-medium">{message}</span>
      {count !== undefined && (
        <span className="ml-auto bg-white bg-opacity-50 px-2 py-1 rounded-full text-sm font-medium">
          {count}
        </span>
      )}
    </div>
  );
};

export default AlertBadge;