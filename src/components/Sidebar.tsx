import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderKanban,
  Target,
  Archive,
  HelpCircle,
  LogOut, 
  Lock,
  ChevronDown,
  ChevronUp,
  FilePlus,
  Users,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const Sidebar = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({
    dashboard: 0,
    fiches: 0,
    projets: 0,
    objectifs: 0,
    archives: 0,
    affectations: 0
  });
  const [hasAlerts, setHasAlerts] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (data) setUserRole(data.role);
    };

    fetchUserRole();
  }, []);

  useEffect(() => {
    const fetchCounts = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      try {
        // Fetch fiches based on user role
        let query = supabase.from('fiches').select('*', { count: 'exact' });

        if (userRole === 'employe') {
          query = query.eq('auteur_id', session.user.id).eq('statut', 'brouillon');
        } else if (userRole === 'coach_rh') {
          query = query.eq('etape_actuelle', 'coach_rh').eq('statut', 'en_validation');
        } else if (userRole === 'referent_projet') {
          query = query.eq('etape_actuelle', 'referent_projet').eq('statut', 'en_validation');
        }

        const { count: fichesCount } = await query;

        // Check for alerts (fiches in validation > 7 days)
        const now = new Date();
        const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
        
        const { count: alertCount } = await supabase
          .from('fiches')
          .select('*', { count: 'exact' })
          .eq('statut', 'en_validation')
          .lt('updated_at', sevenDaysAgo.toISOString());

        setHasAlerts(alertCount > 0);

        // Count project fiches
        const { count: projetsCount } = await supabase
          .from('fiches')
          .select('*', { count: 'exact' })
          .eq('type', 'projet')
          .eq('statut', 'en_validation');

        // Count annual objectives
        const { count: objectifsCount } = await supabase
          .from('fiches')
          .select('*', { count: 'exact' })
          .eq('type', 'annuelle')
          .eq('statut', 'en_validation');

        // Count archived fiches
        const { count: archivesCount } = await supabase
          .from('fiches')
          .select('*', { count: 'exact' })
          .eq('statut', 'validee');

        // Count unassigned employees for direction
        let affectationsCount = 0;
        if (userRole === 'direction') {
          // First, get all assigned employee IDs
          const { data: assignedEmployees } = await supabase
            .from('affectations')
            .select('id_employe');

          const assignedIds = assignedEmployees?.map(a => a.id_employe) || [];

          // Then, count employees who are not in the assigned list
          const query = supabase
            .from('user_profiles')
            .select('*', { count: 'exact' })
            .eq('role', 'employe');

          // Only apply the not.in filter if there are assigned IDs
          if (assignedIds.length > 0) {
            query.not('id', 'in', `(${assignedIds.join(',')})`);
          }

          const { count } = await query;
          affectationsCount = count || 0;
        }

        setCounts({
          dashboard: alertCount || 0,
          fiches: fichesCount || 0,
          projets: projetsCount || 0,
          objectifs: objectifsCount || 0,
          archives: archivesCount || 0,
          affectations: affectationsCount
        });

      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    };

    if (userRole) {
      fetchCounts();
      // Refresh counts every minute
      const interval = setInterval(fetchCounts, 60000);
      return () => clearInterval(interval);
    }
  }, [userRole]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (newPassword !== confirmPassword) {
        throw new Error('Les mots de passe ne correspondent pas');
      }

      if (newPassword.length < 6) {
        throw new Error('Le nouveau mot de passe doit contenir au moins 6 caractères');
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Mot de passe modifié avec succès');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const renderCounter = (count: number, showAlert = false) => {
    if (count === 0 && !showAlert) return null;

    if (showAlert) {
      return (
        <span className="flex items-center justify-center w-6 h-6 ml-auto rounded-full bg-red-100 text-red-600">
          <AlertCircle className="w-4 h-4" />
        </span>
      );
    }

    return (
      <span className="flex items-center justify-center min-w-[1.5rem] h-6 ml-auto px-2 rounded-full bg-gray-700 text-white text-sm">
        {count}
      </span>
    );
  };

  const menuItems = [
    {
      to: '/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      label: 'Tableau de bord',
      count: counts.dashboard,
      showAlert: hasAlerts
    },
    {
      to: '/fiches/create',
      icon: <FilePlus className="w-5 h-5" />,
      label: 'Nouvelle fiche'
    },
    {
      to: '/fiches-projets',
      icon: <FolderKanban className="w-5 h-5" />,
      label: 'Fiches projets',
      count: counts.projets
    },
    {
      to: '/objectifs-annuels',
      icon: <Target className="w-5 h-5" />,
      label: 'Objectifs annuels',
      count: counts.objectifs
    },
    {
      to: '/archives',
      icon: <Archive className="w-5 h-5" />,
      label: 'Archives',
      count: counts.archives
    },
    {
      to: '/aide',
      icon: <HelpCircle className="w-5 h-5" />,
      label: 'Aide'
    },
  ];

  // Add admin menu items for direction role
  if (userRole === 'direction') {
    menuItems.push({
      to: '/admin/affectations',
      icon: <Users className="w-5 h-5" />,
      label: 'Gestion des affectations',
      count: counts.affectations
    });
  }

  return (
    <div className="fixed left-0 top-0 h-screen w-64 bg-gray-900 text-white p-4">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-2xl font-bold mb-2">objeQtifs</h1>
        <p className="text-sm text-gray-400">{userRole || 'Chargement...'}</p>
      </div>
      
      <nav className="space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2 p-3 rounded-lg transition-colors ${
                isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            {item.icon}
            <span className="flex-grow">{item.label}</span>
            {renderCounter(item.count, item.showAlert)}
          </NavLink>
        ))}
      </nav>
      
      <div className="absolute bottom-4 left-4 right-4 space-y-2">
        <div className="border-t border-gray-800 pt-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center justify-between w-full p-3 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Paramètres
            </div>
            {showSettings ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showSettings && (
            <form onSubmit={handlePasswordChange} className="p-3 space-y-3">
              {error && (
                <div className="text-sm text-red-400 bg-red-900/20 p-2 rounded">
                  {error}
                </div>
              )}
              {success && (
                <div className="text-sm text-green-400 bg-green-900/20 p-2 rounded">
                  {success}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-indigo-500"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-indigo-500"
                  required
                  minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm"
              >
                {loading ? 'Modification...' : 'Modifier le mot de passe'}
              </button>
            </form>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full p-3 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Déconnexion
        </button>
      </div>
    </div>
  );
};

export default Sidebar;