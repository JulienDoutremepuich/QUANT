import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Save, AlertCircle } from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
}

interface Affectation {
  id: string;
  id_employe: string;
  id_coach: string | null;
  id_referent_projet: string | null;
}

const AdminAffectations = () => {
  const [employes, setEmployes] = useState<UserProfile[]>([]);
  const [coaches, setCoaches] = useState<UserProfile[]>([]);
  const [referents, setReferents] = useState<UserProfile[]>([]);
  const [affectations, setAffectations] = useState<Affectation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Verify user is direction
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Non authentifié');

        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (userProfile?.role !== 'direction') {
          throw new Error('Accès non autorisé');
        }

        // Fetch all users by role
        const { data: employesData } = await supabase
          .from('user_profiles')
          .select('id, full_name, role')
          .eq('role', 'employe');

        const { data: coachesData } = await supabase
          .from('user_profiles')
          .select('id, full_name, role')
          .eq('role', 'coach_rh');

        const { data: referentsData } = await supabase
          .from('user_profiles')
          .select('id, full_name, role')
          .eq('role', 'referent_projet');

        const { data: affectationsData } = await supabase
          .from('affectations')
          .select('*');

        if (employesData) setEmployes(employesData);
        if (coachesData) setCoaches(coachesData);
        if (referentsData) setReferents(referentsData);
        if (affectationsData) setAffectations(affectationsData);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAffectationUpdate = async (
    employeId: string,
    coachId: string | null,
    referentId: string | null
  ) => {
    try {
      setError(null);
      setSuccess(null);

      const existingAffectation = affectations.find(a => a.id_employe === employeId);

      if (existingAffectation) {
        // Update existing affectation
        const { error: updateError } = await supabase
          .from('affectations')
          .update({
            id_coach: coachId,
            id_referent_projet: referentId
          })
          .eq('id_employe', employeId);

        if (updateError) throw updateError;
      } else {
        // Create new affectation
        const { error: insertError } = await supabase
          .from('affectations')
          .insert([{
            id_employe: employeId,
            id_coach: coachId,
            id_referent_projet: referentId
          }]);

        if (insertError) throw insertError;
      }

      // Refresh affectations
      const { data: newAffectations } = await supabase
        .from('affectations')
        .select('*');

      if (newAffectations) setAffectations(newAffectations);
      setSuccess('Affectations mises à jour avec succès');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">
            Gestion des affectations
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-400 rounded">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-400 rounded">
            <div className="flex items-center gap-2">
              <Save className="w-5 h-5 text-green-400" />
              <p className="text-green-700">{success}</p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employé
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Coach RH
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Référent Projet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employes.map((employe) => {
                const affectation = affectations.find(a => a.id_employe === employe.id);

                return (
                  <tr key={employe.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {employe.full_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        value={affectation?.id_coach || ''}
                        onChange={(e) => handleAffectationUpdate(
                          employe.id,
                          e.target.value || null,
                          affectation?.id_referent_projet
                        )}
                      >
                        <option value="">Sélectionner un coach</option>
                        {coaches.map((coach) => (
                          <option key={coach.id} value={coach.id}>
                            {coach.full_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        value={affectation?.id_referent_projet || ''}
                        onChange={(e) => handleAffectationUpdate(
                          employe.id,
                          affectation?.id_coach,
                          e.target.value || null
                        )}
                      >
                        <option value="">Sélectionner un référent</option>
                        {referents.map((referent) => (
                          <option key={referent.id} value={referent.id}>
                            {referent.full_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {affectation ? 'Affectation existante' : 'Nouvelle affectation'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAffectations;