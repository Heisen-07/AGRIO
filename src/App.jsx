import React, { useState } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [activeView, setActiveView] = useState('landing'); // 'landing' | 'login' | 'dashboard'
  const [activeTab, setActiveTab] = useState('irrigation'); // 'irrigation' | 'climate' | 'analytics' | 'diagnostics'
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  return (
    <LanguageProvider>
      <div className="min-h-screen bg-white flex flex-col font-sans overflow-x-hidden w-full max-w-full">
        {/* Top Navbar — hide on desktop dashboard (sidebar replaces it), overlay on landing */}
        <div className={activeView === 'dashboard' ? 'md:hidden' : activeView === 'landing' ? 'absolute top-0 w-full z-50 bg-transparent' : ''}>
          <Navbar
            activeView={activeView}
            setActiveView={setActiveView}
            isLoggedIn={isLoggedIn}
            setIsLoggedIn={setIsLoggedIn}
          />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 w-full min-w-0 max-w-full">
          {activeView === 'landing' && (
            <LandingPage
              onExploreDashboard={() => setActiveView('dashboard')}
              onSignIn={() => setActiveView('login')}
            />
          )}

          {activeView === 'login' && (
            <LoginPage
              onLoginSuccess={() => {
                setIsLoggedIn(true);
                setActiveView('dashboard');
              }}
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
    </LanguageProvider>
  );
}
