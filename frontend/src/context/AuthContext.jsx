import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { auth } from "../api/client";

const AuthContext = createContext(null);

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "user_data";

// Token refresh will trigger 5 minutes before access token expires
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [refreshToken, setRefreshToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
            const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
            const storedUser = localStorage.getItem(USER_KEY);

            if (storedAccessToken && storedRefreshToken && storedUser) {
                setToken(storedAccessToken);
                setRefreshToken(storedRefreshToken);
                setUser(JSON.parse(storedUser));
                
                // Verify token is still valid by fetching user data
                try {
                    const userData = await auth.me();
                    setUser(userData);
                } catch (error) {
                    // Token invalid, try to refresh
                    try {
                        const newTokens = await auth.refresh(storedRefreshToken);
                        setToken(newTokens.access_token);
                        setRefreshToken(newTokens.refresh_token);
                        localStorage.setItem(ACCESS_TOKEN_KEY, newTokens.access_token);
                        localStorage.setItem(REFRESH_TOKEN_KEY, newTokens.refresh_token);
                        const userData = await auth.me();
                        setUser(userData);
                    } catch (refreshError) {
                        clearAuth();
                    }
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const getTokenExpiry = (token) => {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp * 1000;
        } catch {
            return null;
        }
    };

    // Auto-refresh token before it expires
    useEffect(() => {
        if (!refreshToken || !token) return;

        const checkAndRefreshToken = async () => {
            const expiry = getTokenExpiry(token);
            if (!expiry) return;

            const now = Date.now();
            const timeUntilExpiry = expiry - now;

            // Only refresh if token expires in less than 5 minutes
            if (timeUntilExpiry < TOKEN_REFRESH_BUFFER_MS && timeUntilExpiry > 0) {
                try {
                    const newTokens = await auth.refresh(refreshToken);
                    setToken(newTokens.access_token);
                    setRefreshToken(newTokens.refresh_token);
                    localStorage.setItem(ACCESS_TOKEN_KEY, newTokens.access_token);
                    localStorage.setItem(REFRESH_TOKEN_KEY, newTokens.refresh_token);
                } catch (error) {
                    console.error("Token refresh failed:", error);
                }
            }
        };

        // Check every minute
        const interval = setInterval(checkAndRefreshToken, 60 * 1000);

        return () => clearInterval(interval);
    }, [refreshToken, token]);

    const clearAuth = () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
        setToken(null);
        setRefreshToken(null);
    };

    const login = useCallback(async (email, password) => {
        const tokens = await auth.login(email, password);
        
        localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
        localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
        
        const userData = await auth.me();
        
        setToken(tokens.access_token);
        setRefreshToken(tokens.refresh_token);
        setUser(userData);
        
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        
        return userData;
    }, []);
    const logout = useCallback(async () => {
        if (refreshToken) {
            try {
                await auth.logout(refreshToken);
            } catch (error) {
            }
        }
        clearAuth();
    }, [refreshToken]);

    return (
        <AuthContext.Provider value={{ 
            user, 
            token, 
            refreshToken,
            login, 
            logout,
            isLoading 
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}