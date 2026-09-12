import { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { UserProvider } from './context/UserContext';
import { FarmProvider } from './context/FarmContext';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import OfflineBanner from './components/OfflineBanner';

function AppContent() {
  const [activeView, setActiveView] = useState('landing'); // 'landing' | 'dashboard'
  const [activeTab, setActiveTab] = useState('advisory'); // 'advisory' | 'diagnostics' | 'irrigation' | 'climate' | 'analytics'
  const { toggleLanguage } = useLanguage();

  // Bridge custom events for view / tab navigation
  useEffect(() => {
    const toDashboard = () => setActiveView('dashboard');
    const toDiagnostics = () => {
      setActiveView('dashboard');
      setActiveTab('diagnostics');
    };
    const onLogout = () => setActiveView('landing');
    const onToggleLang = () => toggleLanguage();

    window.addEventListener('agrio:to-dashboard', toDashboard);
    window.addEventListener('agrio:to-diagnostics', toDiagnostics);
    window.addEventListener('agrio:logout', onLogout);
    window.addEventListener('agrio:toggle-lang', onToggleLang);

    return () => {
      window.removeEventListener('agrio:to-dashboard', toDashboard);
      window.removeEventListener('agrio:to-diagnostics', toDiagnostics);
      window.removeEventListener('agrio:logout', onLogout);
      window.removeEventListener('agrio:toggle-lang', onToggleLang);
    };
  }, [toggleLanguage]);

  return (
    <div className="relative min-h-screen bg-white flex flex-col font-sans overflow-x-hidden w-full max-w-full">
      <OfflineBanner />
      {/* Top Navbar — landing only. Dashboard has its own mobile header + sidebar */}
      {activeView !== 'dashboard' && (
        <div className="absolute top-0 w-full z-50 bg-transparent">
          <Navbar
            activeView={activeView}
            setActiveView={setActiveView}
          />
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full min-w-0 max-w-full">
        {activeView === 'landing' && (
          <LandingPage
            onExploreDashboard={() => setActiveView('dashboard')}
          />
        )}

        {activeView === 'dashboard' && (
          <Dashboard
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setActiveView={setActiveView}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      {activeView === 'dashboard' && (
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <UserProvider>
        <FarmProvider>
          <AppContent />
        </FarmProvider>
      </UserProvider>
    </LanguageProvider>
  );
}
