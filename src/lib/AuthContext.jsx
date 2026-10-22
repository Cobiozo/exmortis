import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AUTH_BACKEND } from '@/api/exmAdapter';

const AuthContext = createContext();

// Ostatnie potwierdzone konto z tego urządzenia — używane tylko offline (aplikacja na telefonie),
// gdy nie ma jak zapytać serwera. Kasowane przy wylogowaniu.
const USER_CACHE = "exm_auth_user";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      // Przy Supabase sesja nie zależy od ustawień ani tokena aplikacji Base44.
      if (AUTH_BACKEND === 'supabase') {
        await checkUserAuth();
        setIsLoadingPublicSettings(false);
        return;
      }
      
      try {
        const publicSettings = await base44.app.getPublicSettings();
        setAppPublicSettings(publicSettings);
        
        // Sesja zawsze jest sprawdzana (po wyjściu z platformy token platformy nie istnieje).
        await checkUserAuth();
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      try { localStorage.setItem(USER_CACHE, JSON.stringify(currentUser)); } catch { /* brak pamięci */ }
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      // Offline: nie ma jak potwierdzić sesji, więc wracamy do ostatniego znanego konta z tego
      // urządzenia — inaczej ROZDROŻA i Minutnik nie uruchomiłyby się bez internetu.
      let offlineUser = null;
      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          offlineUser = JSON.parse(localStorage.getItem(USER_CACHE) || "null");
        }
      } catch { /* brak pamięci */ }
      setUser(offlineUser);
      setIsAuthenticated(!!offlineUser);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      // Brak sesji = gość — strony prywatne sam pilnuje ProtectedRoute, bez przekierowania całej strony.
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    try { localStorage.removeItem(USER_CACHE); } catch { /* brak pamięci */ }
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};