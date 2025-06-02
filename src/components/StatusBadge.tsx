import React from 'react';
import { 
  PenLine, 
  ClipboardCheck, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';

type Status = 'brouillon' | 'en_validation' | 'validee' | 'refusee';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getStatusConfig = (status: Status) => {
    switch (status) {
      case 'brouillon':
        return {
          icon: PenLine,
          label: 'Brouillon',
          color: 'bg-gray-100 text-gray-800',
          tooltip: 'Cette fiche est en cours de rédaction'
        };
      case 'en_validation':
        return {
          icon: ClipboardCheck,
          label: 'En validation',
          color: 'bg-yellow-100 text-yellow-800',
          tooltip: 'Cette fiche est en cours de validation'
        };
      case 'validee':
        return {
          icon: CheckCircle2,
          label: 'Validée',
          color: 'bg-green-100 text-green-800',
          tooltip: 'Cette fiche a été validée'
        };
      case 'refusee':
        return {
          icon: XCircle,
          label: 'Refusée',
          color: 'bg-red-100 text-red-800',
          tooltip: 'Cette fiche a été refusée'
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${config.color} ${className}`}
      title={config.tooltip}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{config.label}</span>
    </div>
  );
};

export default StatusBadge;