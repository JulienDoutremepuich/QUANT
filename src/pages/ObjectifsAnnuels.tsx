import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BarChart as BarChartIcon, 
  Calendar, 
  Clock, 
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter
} from 'lucide-react';
import { format, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface KPIs {
  completionRate: number;
  onTimeRate: number;
  evaluationRate: number;
  totalFiches: number;
  lateFiches: number;
  missingFiches: number;
}

interface ChartData {
  name: string;
  value: number;
}

interface FicheRetard {
  id: string;
  type: string;
  auteur: {
    full_name: string;
  };
  created_at: string;
  updated_at: string;
  statut: string;
}

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444'];

const ObjectifsAnnuels = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KPIs>({
    completionRate: 0,
    onTimeRate: 0,
    evaluationRate: 0,
    totalFiches: 0,
    lateFiches: 0,
    missingFiches: 0
  });
  const [statusData, setStatusData] = useState<ChartData[]>([]);
  const [typeData, setTypeData] = useState<ChartData[]>([]);
  const [fichesRetard, setFichesRetard] = useState<FicheRetard[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Verify user role
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Non authentifié');

        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!['direction', 'coach_rh'].includes(userProfile?.role || '')) {
          throw new Error('Accès non autorisé');
        }

        const startDate = startOfYear(new Date(selectedYear, 0, 1));
        const endDate = endOfYear(new Date(selectedYear, 11, 31));

        // Fetch all fiches for the selected year
        const { data: fiches, error: fichesError } = await supabase
          .from('fiches')
          .select(`
            *,
            auteur:user_profiles!fiches_auteur_id_fkey(
              full_name
            )
          `)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        if (fichesError) throw fichesError;

        // Calculate KPIs
        const total = fiches?.length || 0;
        const completed = fiches?.filter(f => f.statut === 'validee').length || 0;
        const onTime = fiches?.filter(f => {
          const createdDate = new Date(f.created_at);
          const updatedDate = new Date(f.updated_at);
          const delay = Math.floor((updatedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          return delay <= 30; // Consider 30 days as the deadline
        }).length || 0;
        const evaluations = fiches?.filter(f => f.type === 'evaluation').length || 0;
        const expectedEvaluations = 4; // Assuming 4 evaluations per year

        setKpis({
          completionRate: (completed / total) * 100,
          onTimeRate: (onTime / total) * 100,
          evaluationRate: (evaluations / expectedEvaluations) * 100,
          totalFiches: total,
          lateFiches: total - onTime,
          missingFiches: expectedEvaluations - evaluations
        });

        // Prepare chart data
        const statusStats = fiches?.reduce((acc: Record<string, number>, fiche) => {
          acc[fiche.statut] = (acc[fiche.statut] || 0) + 1;
          return acc;
        }, {});

        const typeStats = fiches?.reduce((acc: Record<string, number>, fiche) => {
          acc[fiche.type] = (acc[fiche.type] || 0) + 1;
          return acc;
        }, {});

        setStatusData(Object.entries(statusStats || {}).map(([name, value]) => ({ name, value })));
        setTypeData(Object.entries(typeStats || {}).map(([name, value]) => ({ name, value })));

        // Get late fiches
        const lateFiches = fiches?.filter(f => {
          const createdDate = new Date(f.created_at);
          const updatedDate = new Date(f.updated_at);
          const delay = Math.floor((updatedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          return delay > 30;
        });

        setFichesRetard(lateFiches || []);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedYear]);

  const exportToCSV = () => {
    const headers = ['ID', 'Type', 'Auteur', 'Créée le', 'Mise à jour le', 'Statut'];
    const csvContent = [
      headers.join(','),
      ...fichesRetard.map(fiche => [
        fiche.id,
        fiche.type,
        fiche.auteur.full_name,
        format(new Date(fiche.created_at), 'dd/MM/yyyy'),
        format(new Date(fiche.updated_at), 'dd/MM/yyyy'),
        fiche.statut
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fiches-retard-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChartIcon className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              Objectifs Annuels
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <button
              onClick={exportToCSV}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Download className="w-4 h-4 mr-2" />
              Exporter les retards
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <h3 className="text-lg font-medium text-gray-900">Taux de complétion</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {kpis.completionRate.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {kpis.totalFiches} fiches au total
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-medium text-gray-900">Respect des délais</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {kpis.onTimeRate.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {kpis.lateFiches} fiches en retard
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-medium text-gray-900">Évaluations réalisées</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {kpis.evaluationRate.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {kpis.missingFiches} évaluations manquantes
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Répartition par statut</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Répartition par type</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#4F46E5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Late Fiches Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-medium text-gray-900">
              Fiches en retard ({fichesRetard.length})
            </h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auteur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Créée le</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Retard</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {fichesRetard.map((fiche) => {
                const createdDate = new Date(fiche.created_at);
                const updatedDate = new Date(fiche.updated_at);
                const delay = Math.floor((updatedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

                return (
                  <tr key={fiche.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="capitalize">{fiche.type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {fiche.auteur.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(fiche.created_at), "d MMMM yyyy", { locale: fr })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-amber-600 font-medium">
                        {delay} jours
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="capitalize">{fiche.statut}</span>
                    </td>
                  </tr>
                );
              })}
              {fichesRetard.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Aucune fiche en retard
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

export default ObjectifsAnnuels;