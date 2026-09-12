import { createContext, useContext, useState } from 'react';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);

  const value = {
    user,
    setUser,
    loading: false,
    error: null,
    isAuthenticated: () => false,
    login: async () => {},
    register: async () => {},
    logout: async () => setUser(null),
    refreshProfile: async () => {},
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}