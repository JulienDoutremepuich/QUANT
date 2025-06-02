import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  MessageCircle, 
  History,
  User,
  FileText,
  Tag,
  AlertCircle,
  Lock,
  Calendar,
  MessageSquare,
  X
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import WorkflowProgress from '../components/WorkflowProgress';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Fiche {
  id: string;
  type: 'annuelle' | 'projet' | 'evaluation';
  statut: 'brouillon' | 'en_validation' | 'validee' | 'refusee';
  contenu: string;
  auteur_id: string;
  version: number;
  created_at: string;
  updated_at: string;
  etape_actuelle: 'employe' | 'referent_projet' | 'coach_rh' | 'direction';
  auteur: {
    full_name: string;
    role: string;
  };
}

interface FicheVersion {
  id: string;
  fiche_id: string;
  version: number;
  contenu: string;
  statut: 'brouillon' | 'en_validation' | 'validee' | 'refusee';
  created_at: string;
}

interface ActionJournal {
  id: string;
  action_type: 'validation' | 'refus' | 'commentaire';
  created_at: string;
  comment: string | null;
  user: {
    full_name: string;
    role: string;
  };
}

const REFUSAL_REASONS = [
  'Informations incomplètes',
  'Objectifs mal définis',
  'Non aligné avec la stratégie',
  'Besoin de clarification',
  'Format incorrect',
  'Autre'
];

const FicheDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [versions, setVersions] = useState<FicheVersion[]>([]);
  const [journal, setJournal] = useState<ActionJournal[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [showRefusalModal, setShowRefusalModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [refusalComment, setRefusalComment] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (userProfile) {
          setUserRole(userProfile.role);
        }

        const { data: ficheData, error: ficheError } = await supabase
          .from('fiches')
          .select(`
            *,
            auteur:user_profiles!fiches_auteur_id_fkey(
              full_name,
              role
            )
          `)
          .eq('id', id)
          .single();

        if (ficheError) throw ficheError;
        setFiche(ficheData);

        const { data: versionsData, error: versionsError } = await supabase
          .from('fiches_versions')
          .select('*')
          .eq('fiche_id', id)
          .order('version', { ascending: false });

        if (versionsError) throw versionsError;
        setVersions(versionsData);

        const { data: journalData, error: journalError } = await supabase
          .from('journal_actions')
          .select(`
            *,
            user:user_profiles!journal_actions_user_id_fkey(
              full_name,
              role
            )
          `)
          .eq('fiche_id', id)
          .order('created_at', { ascending: false });

        if (journalError) throw journalError;
        setJournal(journalData);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const addJournalEntry = async (actionType: 'validation' | 'refus' | 'commentaire', comment?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: journalError } = await supabase
        .from('journal_actions')
        .insert([{
          fiche_id: id,
          user_id: user.id,
          action_type: actionType,
          comment: comment
        }]);

      if (journalError) throw journalError;

      const { data: journalData } = await supabase
        .from('journal_actions')
        .select(`
          *,
          user:user_profiles!journal_actions_user_id_fkey(
            full_name,
            role
          )
        `)
        .eq('fiche_id', id)
        .order('created_at', { ascending: false });

      if (journalData) setJournal(journalData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleStatusUpdate = async (newStatus: 'validee' | 'refusee') => {
    if (newStatus === 'refusee') {
      setShowRefusalModal(true);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('fiches')
        .update({ statut: newStatus })
        .eq('id', id);

      if (updateError) throw updateError;

      setFiche(fiche => fiche ? { ...fiche, statut: newStatus } : null);
      await addJournalEntry('validation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleRefusal = async () => {
    if (!selectedReason) return;

    try {
      const { error: updateError } = await supabase
        .from('fiches')
        .update({ statut: 'refusee' })
        .eq('id', id);

      if (updateError) throw updateError;

      const comment = `Motif : ${selectedReason}${refusalComment ? `\n\nCommentaire : ${refusalComment}` : ''}`;
      await addJournalEntry('refus', comment);

      setFiche(fiche => fiche ? { ...fiche, statut: 'refusee' } : null);
      setShowRefusalModal(false);
      setSelectedReason('');
      setRefusalComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setAddingComment(true);
    try {
      await addJournalEntry('commentaire', comment);
      setComment('');
    } finally {
      setAddingComment(false);
    }
  };

  const isLocked = fiche?.statut === 'validee';
  const canValidate = userRole === 'direction' && fiche?.statut === 'en_validation' && !isLocked;
  const canComment = ['coach_rh', 'direction'].includes(userRole || '') && 
                    ['en_validation', 'validee'].includes(fiche?.statut || '');

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !fiche) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          <p>{error || 'Fiche not found'}</p>
        </div>
      </div>
    );
  }

  const lastRefusal = journal.find(entry => entry.action_type === 'refus');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Refusal Modal */}
      {showRefusalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Motif du refus</h3>
              <button
                onClick={() => setShowRefusalModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sélectionnez un motif
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Choisir un motif</option>
                  {REFUSAL_REASONS.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Commentaire additionnel (optionnel)
                </label>
                <textarea
                  value={refusalComment}
                  onChange={(e) => setRefusalComment(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Détaillez votre refus..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowRefusalModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleRefusal}
                  disabled={!selectedReason}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  Refuser la fiche
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Fiche {fiche.type}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={fiche.statut} />
                <span className="text-sm text-gray-500">
                  Version {fiche.version}
                </span>
                {isLocked && (
                  <div className="flex items-center gap-1 text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    <Lock className="w-4 h-4" />
                    <span className="text-sm">Verrouillée</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canValidate && (
              <>
                <button
                  onClick={() => handleStatusUpdate('validee')}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Valider
                </button>
                <button
                  onClick={() => handleStatusUpdate('refusee')}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Refuser
                </button>
              </>
            )}
          </div>
        </div>

        {/* Refusal Alert */}
        {fiche.statut === 'refusee' && lastRefusal && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-800">
                  Fiche refusée par {lastRefusal.user.full_name}
                </h3>
                <p className="mt-1 text-sm text-red-700 whitespace-pre-wrap">
                  {lastRefusal.comment}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Locked Banner */}
        {isLocked && (
          <div className="mb-6 p-4 bg-gray-50 border-l-4 border-gray-500 rounded">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-gray-600" />
              <p className="text-gray-700">
                Cette fiche est verrouillée car elle a été validée. Aucune modification n'est possible.
              </p>
            </div>
          </div>
        )}

        {/* Workflow Progress */}
        <div className="mb-8">
          <WorkflowProgress 
            type={fiche.type} 
            status={fiche.statut}
            etapeActuelle={fiche.etape_actuelle}
            className="mt-2" 
          />
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Auteur: {fiche.auteur.full_name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Type: {fiche.type}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Créée le: {new Date(fiche.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Statut: {fiche.statut}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className={`prose max-w-none ${isLocked ? 'select-text' : ''}`}>
          <div className="whitespace-pre-wrap">{fiche.contenu}</div>
        </div>

        {/* Comment Form */}
        {canComment && (
          <form onSubmit={handleAddComment} className="mt-8 border-t border-gray-200 pt-6">
            <div className="flex items-start gap-4">
              <div className="flex-grow">
                <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
                  Ajouter un commentaire
                </label>
                <textarea
                  id="comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Votre commentaire..."
                />
              </div>
              <button
                type="submit"
                disabled={addingComment || !comment.trim()}
                className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {addingComment ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </form>
        )}

        {/* Action Journal */}
        <div className="mt-8 border-t border-gray-200 pt-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Historique des actions</h2>
          <div className="space-y-4">
            {journal.map((entry) => (
              <div key={entry.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  {entry.action_type === 'validation' && (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  )}
                  {entry.action_type === 'refus' && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  {entry.action_type === 'commentaire' && (
                    <MessageCircle className="w-5 h-5 text-blue-500" />
                  )}
                </div>
                <div className="flex-grow">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{entry.user.full_name}</span>
                    <span className="text-sm text-gray-500">({entry.user.role})</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {format(new Date(entry.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </div>
                  {entry.comment && (
                    <div className="mt-2 text-gray-700 whitespace-pre-wrap">{entry.comment}</div>
                  )}
                </div>
              </div>
            ))}
            {journal.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                Aucune action enregistrée
              </div>
            )}
          </div>
        </div>

        {/* Versions Panel */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={() => setShowVersions(!showVersions)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <History className="w-4 h-4 mr-2" />
            {showVersions ? 'Masquer les versions' : 'Voir les versions précédentes'}
          </button>

          {showVersions && versions.length > 0 && (
            <div className="mt-4 space-y-4">
              {versions.map((version) => (
                <div key={version.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        Version {version.version}
                      </span>
                      <StatusBadge status={version.statut} />
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(version.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-gray-600">
                    {version.contenu}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FicheDetail;