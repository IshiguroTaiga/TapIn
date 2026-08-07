import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('tapin_token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('tapin_user') || 'null'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Request Interceptor: Attach Authorization header to all requests dynamically
    const reqInterceptor = axios.interceptors.request.use((config) => {
      const storedToken = localStorage.getItem('tapin_token');
      if (storedToken) {
        config.headers.Authorization = `Bearer ${storedToken}`;
      }
      return config;
    }, (error) => Promise.reject(error));

    // Response Interceptor: Automatically clear expired token on 401
    const resInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && (error.response.status === 401 || (error.response.status === 403 && error.response.data?.error?.includes('token')))) {
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(reqInterceptor);
      axios.interceptors.response.eject(resInterceptor);
    };
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      const { token, user } = res.data;
      setToken(token);
      setUser(user);
      localStorage.setItem('tapin_token', token);
      localStorage.setItem('tapin_user', JSON.stringify(user));
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || 'Login failed. Please check credentials.'
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('tapin_token');
    localStorage.removeItem('tapin_user');
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
