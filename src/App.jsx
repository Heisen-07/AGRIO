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
      <div className="min-h-screen bg-[#F8FAF9] flex flex-col font-sans">
        {/* Top Navbar */}
        <Navbar
          activeView={activeView}
          setActiveView={setActiveView}
          isLoggedIn={isLoggedIn}
          setIsLoggedIn={setIsLoggedIn}
        />

        {/* Main Content Area */}
        <main className="flex-1">
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
