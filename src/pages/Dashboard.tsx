import React, { useState, useEffect } from 'react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  Users, 
  Star,
  FileText,
  Clock,
  ArrowRight,
  XCircle,
  ClipboardCheck,
  Filter,
  Calendar
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import AlertBadge from '../components/AlertBadge';

interface UserProfile {
  id: string;
  full_name: string | null;
  role: string | null;
}

interface Fiche {
  id: string;
  type: 'annuelle' | 'projet' | 'evaluation';
  statut: 'brouillon' | 'en_validation' | 'validee' | 'refusee';
  etape_actuelle: 'employe' | 'referent_projet' | 'coach_rh' | 'direction';
  created_at: string;
  updated_at: string;
  auteur: {
    full_name: string;
    id: string;
  };
}

interface Stats {
  brouillon: number;
  en_validation: number;
  validee: number;
  refusee: number;
}

interface TypeStats {
  annuelle: number;
  projet: number;
  evaluation: number;
}

interface Filters {
  type: string;
  statut: string;
  periode: string;
  auteur: string;
}

interface Alert {
  severity: 'high' | 'medium' | 'low';
  message: string;
  count: number;
}

const DashboardContent = () => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fiches, setFiches] = useState<Fiche[]>([]);
  const [filteredFiches, setFilteredFiches] = useState<Fiche[]>([]);
  const [stats, setStats] = useState<Stats>({ brouillon: 0, en_validation: 0, validee: 0, refusee: 0 });
  const [typeStats, setTypeStats] = useState<TypeStats>({ annuelle: 0, projet: 0, evaluation: 0 });
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    type: '',
    statut: '',
    periode: '',
    auteur: ''
  });
  const [auteurs, setAuteurs] = useState<{ id: string; full_name: string }[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);

        // Fetch fiches based on role
        let query = supabase
          .from('fiches')
          .select(`
            *,
            auteur:user_profiles!fiches_auteur_id_fkey(
              id,
              full_name
            )
          `);

        if (profileData.role === 'employe') {
          query = query.eq('auteur_id', user.id);
        } else if (profileData.role === 'coach_rh') {
          query = query.eq('etape_actuelle', 'coach_rh');
        } else if (profileData.role === 'referent_projet') {
          query = query.eq('etape_actuelle', 'referent_projet');
        }

        const { data: fichesData, error: fichesError } = await query;
        if (fichesError) throw fichesError;
        
        setFiches(fichesData);
        setFilteredFiches(fichesData);

        // Calculate stats
        const statusStats = fichesData.reduce((acc: Stats, fiche: Fiche) => {
          acc[fiche.statut]++;
          return acc;
        }, { brouillon: 0, en_validation: 0, validee: 0, refusee: 0 });
        setStats(statusStats);

        const typeStats = fichesData.reduce((acc: TypeStats, fiche: Fiche) => {
          acc[fiche.type]++;
          return acc;
        }, { annuelle: 0, projet: 0, evaluation: 0 });
        setTypeStats(typeStats);

        // Get unique authors
        const uniqueAuteurs = Array.from(new Set(fichesData.map(f => f.auteur.id)))
          .map(id => {
            const fiche = fichesData.find(f => f.auteur.id === id);
            return {
              id: fiche!.auteur.id,
              full_name: fiche!.auteur.full_name
            };
          });
        setAuteurs(uniqueAuteurs);

        // Calculate alerts
        const now = new Date();
        const alerts: Alert[] = [];

        // Fiches in validation for more than 7 days
        const longValidation = fichesData.filter(fiche => {
          if (fiche.statut === 'en_validation') {
            const validationDays = differenceInDays(now, new Date(fiche.updated_at));
            return validationDays > 7;
          }
          return false;
        });

        if (longValidation.length > 0) {
          alerts.push({
            severity: 'high',
            message: 'Fiches en validation depuis plus de 7 jours',
            count: longValidation.length
          });
        }

        // Pending validation fiches
        const pendingValidation = fichesData.filter(fiche => fiche.statut === 'en_validation');
        if (pendingValidation.length > 0) {
          alerts.push({
            severity: 'medium',
            message: 'Fiches en attente de validation',
            count: pendingValidation.length
          });
        }

        // Late fiches (created more than 30 days ago and still not validated)
        const lateFiches = fichesData.filter(fiche => {
          if (fiche.statut !== 'validee') {
            const ageDays = differenceInDays(now, new Date(fiche.created_at));
            return ageDays > 30;
          }
          return false;
        });

        if (lateFiches.length > 0) {
          alerts.push({
            severity: 'high',
            message: 'Fiches en retard (plus de 30 jours)',
            count: lateFiches.length
          });
        }

        setAlerts(alerts);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    let filtered = [...fiches];

    if (filters.type) {
      filtered = filtered.filter(f => f.type === filters.type);
    }
    if (filters.statut) {
      filtered = filtered.filter(f => f.statut === filters.statut);
    }
    if (filters.auteur) {
      filtered = filtered.filter(f => f.auteur.id === filters.auteur);
    }
    if (filters.periode) {
      const now = new Date();
      switch (filters.periode) {
        case 'semaine':
          filtered = filtered.filter(f => {
            const date = new Date(f.created_at);
            return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) <= 7;
          });
          break;
        case 'mois':
          filtered = filtered.filter(f => {
            const date = new Date(f.created_at);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
          });
          break;
        case 'trimestre':
          filtered = filtered.filter(f => {
            const date = new Date(f.created_at);
            return Math.floor(date.getMonth() / 3) === Math.floor(now.getMonth() / 3) && 
                   date.getFullYear() === now.getFullYear();
          });
          break;
      }
    }

    setFilteredFiches(filtered);
  }, [filters, fiches]);

  const renderStatCard = (
    title: string,
    count: number,
    icon: React.ReactNode,
    bgColor: string,
    textColor: string,
    borderColor: string,
    onClick: () => void
  ) => (
    <button
      onClick={onClick}
      className={`${bgColor} p-6 rounded-lg border ${borderColor} transition-transform hover:scale-105`}
    >
      <h2 className={`text-lg font-semibold ${textColor} mb-2 flex items-center gap-2`}>
        {icon}
        {title}
      </h2>
      <p className={`text-3xl font-bold ${textColor}`}>{count}</p>
    </button>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Bienvenue, {profile?.full_name || 'Utilisateur'}
        </h1>
        <p className="text-lg text-gray-600">
          Rôle : <span className="font-semibold capitalize">{profile?.role || 'Non défini'}</span>
        </p>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-4">
          {alerts.map((alert, index) => (
            <AlertBadge
              key={index}
              severity={alert.severity}
              message={alert.message}
              count={alert.count}
            />
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold">Filtres</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filters.type}
            onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Tous les types</option>
            <option value="annuelle">Fiche annuelle</option>
            <option value="projet">Fiche projet</option>
            <option value="evaluation">Fiche d'évaluation</option>
          </select>

          <select
            value={filters.statut}
            onChange={(e) => setFilters(f => ({ ...f, statut: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Tous les statuts</option>
            <option value="brouillon">Brouillon</option>
            <option value="en_validation">En validation</option>
            <option value="validee">Validée</option>
            <option value="refusee">Refusée</option>
          </select>

          <select
            value={filters.periode}
            onChange={(e) => setFilters(f => ({ ...f, periode: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Toutes les périodes</option>
            <option value="semaine">Cette semaine</option>
            <option value="mois">Ce mois</option>
            <option value="trimestre">Ce trimestre</option>
          </select>

          {profile?.role === 'direction' && (
            <select
              value={filters.auteur}
              onChange={(e) => setFilters(f => ({ ...f, auteur: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Tous les auteurs</option>
              {auteurs.map(auteur => (
                <option key={auteur.id} value={auteur.id}>
                  {auteur.full_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Type Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Par type
          </h2>
          <div className="space-y-4">
            {renderStatCard(
              'Fiches annuelles',
              typeStats.annuelle,
              <Calendar className="w-5 h-5" />,
              'bg-blue-50',
              'text-blue-800',
              'border-blue-200',
              () => setFilters(f => ({ ...f, type: 'annuelle' }))
            )}
            {renderStatCard(
              'Fiches projet',
              typeStats.projet,
              <Star className="w-5 h-5" />,
              'bg-purple-50',
              'text-purple-800',
              'border-purple-200',
              () => setFilters(f => ({ ...f, type: 'projet' }))
            )}
            {renderStatCard(
              'Fiches évaluation',
              typeStats.evaluation,
              <ClipboardCheck className="w-5 h-5" />,
              'bg-green-50',
              'text-green-800',
              'border-green-200',
              () => setFilters(f => ({ ...f, type: 'evaluation' }))
            )}
          </div>
        </div>

        {/* Status Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Par statut
          </h2>
          <div className="space-y-4">
            {renderStatCard(
              'Brouillons',
              stats.brouillon,
              <FileText className="w-5 h-5" />,
              'bg-orange-50',
              'text-orange-800',
              'border-orange-200',
              () => setFilters(f => ({ ...f, statut: 'brouillon' }))
            )}
            {renderStatCard(
              'En validation',
              stats.en_validation,
              <Clock className="w-5 h-5" />,
              'bg-yellow-50',
              'text-yellow-800',
              'border-yellow-200',
              () => setFilters(f => ({ ...f, statut: 'en_validation' }))
            )}
            {renderStatCard(
              'Validées',
              stats.validee,
              <CheckCircle className="w-5 h-5" />,
              'bg-green-50',
              'text-green-800',
              'border-green-200',
              () => setFilters(f => ({ ...f, statut: 'validee' }))
            )}
            {renderStatCard(
              'Refusées',
              stats.refusee,
              <XCircle className="w-5 h-5" />,
              'bg-red-50',
              'text-red-800',
              'border-red-200',
              () => setFilters(f => ({ ...f, statut: 'refusee' }))
            )}
          </div>
        </div>

        {/* Period Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Par période
          </h2>
          <div className="space-y-4">
            {renderStatCard(
              'Cette semaine',
              fiches.filter(f => {
                const date = new Date(f.created_at);
                const now = new Date();
                return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) <= 7;
              }).length,
              <Clock className="w-5 h-5" />,
              'bg-indigo-50',
              'text-indigo-800',
              'border-indigo-200',
              () => setFilters(f => ({ ...f, periode: 'semaine' }))
            )}
            {renderStatCard(
              'Ce mois',
              fiches.filter(f => {
                const date = new Date(f.created_at);
                const now = new Date();
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
              }).length,
              <Calendar className="w-5 h-5" />,
              'bg-cyan-50',
              'text-cyan-800',
              'border-cyan-200',
              () => setFilters(f => ({ ...f, periode: 'mois' }))
            )}
            {renderStatCard(
              'Ce trimestre',
              fiches.filter(f => {
                const date = new Date(f.created_at);
                const now = new Date();
                return Math.floor(date.getMonth() / 3) === Math.floor(now.getMonth() / 3) && 
                       date.getFullYear() === now.getFullYear();
              }).length,
              <Users className="w-5 h-5" />,
              'bg-teal-50',
              'text-teal-800',
              'border-teal-200',
              () => setFilters(f => ({ ...f, periode: 'trimestre' }))
            )}
          </div>
        </div>
      </div>

      {/* Filtered Results */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Fiches {filters.type || filters.statut || filters.periode ? 'filtrées' : 'récentes'}
            </h2>
            <span className="text-sm text-gray-500">
              {filteredFiches.length} résultat{filteredFiches.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auteur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Créée le</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFiches.map((fiche) => (
                <tr key={fiche.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="capitalize">{fiche.type}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={fiche.statut} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {fiche.auteur.full_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(fiche.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      to={`/fiches/${fiche.id}`}
                      className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1"
                    >
                      Voir <ArrowRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredFiches.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Aucune fiche ne correspond aux critères sélectionnés
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  return <DashboardContent />;
};

export default Dashboard;