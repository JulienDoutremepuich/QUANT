import React from 'react';
import { CheckCircle2, Clock, XCircle, Lock } from 'lucide-react';

type FicheType = 'annuelle' | 'projet' | 'evaluation';
type Status = 'brouillon' | 'en_validation' | 'validee' | 'refusee';
type WorkflowStep = 'employe' | 'referent_projet' | 'coach_rh' | 'direction';

interface WorkflowProgressProps {
  type: FicheType;
  status: Status;
  etapeActuelle: WorkflowStep;
  className?: string;
}

const WorkflowProgress: React.FC<WorkflowProgressProps> = ({ 
  type, 
  status, 
  etapeActuelle,
  className = '' 
}) => {
  const getWorkflowSteps = (type: FicheType): { label: string; key: WorkflowStep }[] => {
    switch (type) {
      case 'projet':
        return [
          { label: 'Employé', key: 'employe' },
          { label: 'Référent projet', key: 'referent_projet' },
          { label: 'Direction', key: 'direction' }
        ];
      case 'annuelle':
        return [
          { label: 'Employé', key: 'employe' },
          { label: 'Coach RH', key: 'coach_rh' },
          { label: 'Direction', key: 'direction' }
        ];
      case 'evaluation':
        return [
          { label: 'Employé', key: 'employe' },
          { label: 'Coach RH', key: 'coach_rh' }
        ];
    }
  };

  const steps = getWorkflowSteps(type);
  const currentStepIndex = steps.findIndex(step => step.key === etapeActuelle);
  
  const getStepStatus = (index: number) => {
    if (status === 'refusee') return 'refused';
    if (status === 'validee') return 'locked';
    if (index < currentStepIndex) return 'completed';
    if (index === currentStepIndex) return 'current';
    return 'pending';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="relative">
        {/* Progress bar background */}
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="h-0.5 w-full bg-gray-200"></div>
        </div>
        
        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const stepStatus = getStepStatus(index);
            
            let bgColor = 'bg-gray-200';
            let textColor = 'text-gray-500';
            let icon = <Clock className="w-5 h-5" />;
            
            if (stepStatus === 'completed') {
              bgColor = 'bg-green-600';
              textColor = 'text-green-600';
              icon = <CheckCircle2 className="w-5 h-5" />;
            } else if (stepStatus === 'current') {
              bgColor = 'bg-blue-600';
              textColor = 'text-blue-600';
              icon = <Clock className="w-5 h-5" />;
            } else if (stepStatus === 'refused') {
              bgColor = 'bg-red-600';
              textColor = 'text-red-600';
              icon = <XCircle className="w-5 h-5" />;
            } else if (stepStatus === 'locked') {
              bgColor = 'bg-gray-600';
              textColor = 'text-gray-600';
              icon = <Lock className="w-5 h-5" />;
            }

            return (
              <div key={step.key} className="flex flex-col items-center">
                <div 
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${bgColor} border-2 border-white`}
                  title={`Étape : ${step.label}`}
                >
                  <span className="text-white">{icon}</span>
                </div>
                <p className={`mt-2 text-sm font-medium ${textColor}`}>{step.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkflowProgress;