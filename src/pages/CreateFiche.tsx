import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { FileText, Send } from 'lucide-react';

type FicheType = 'annuelle' | 'projet' | 'evaluation';
type FicheStatus = 'brouillon' | 'en_validation';

const CreateFiche = () => {
  const navigate = useNavigate();
  const [type, setType] = useState<FicheType>('projet');
  const [contenu, setContenu] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent, status: FicheStatus = 'brouillon') => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');

      const { error: insertError } = await supabase
        .from('fiches')
        .insert([
          {
            type,
            contenu,
            statut: status,
            auteur_id: user.id,
          }
        ]);

      if (insertError) throw insertError;

      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle fiche</h1>
        </div>

        <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Type de fiche
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as FicheType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="projet">Fiche projet</option>
              <option value="annuelle">Fiche annuelle</option>
              <option value="evaluation">Fiche d'évaluation</option>
            </select>
          </div>

          <div>
            <label htmlFor="contenu" className="block text-sm font-medium text-gray-700 mb-1">
              Contenu
            </label>
            <textarea
              id="contenu"
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Saisissez le contenu de votre fiche..."
              required
            />
          </div>

          <div className="flex gap-4 justify-end">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Annuler
            </button>
            
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-600 border border-transparent rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer le brouillon'}
            </button>

            <button
              type="button"
              onClick={(e) => handleSubmit(e, 'en_validation')}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Soumission...' : 'Soumettre pour validation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateFiche;