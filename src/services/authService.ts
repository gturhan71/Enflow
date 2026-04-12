/**
 * Authentication Service
 * 
 * Provides mock authentication for the frontend application.
 * In production, this should communicate with a real backend
 * (/api/v1/auth/login) and handle JWT tokens. Look at how
 * the credentials are not hardcoded in the component itself.
 */

export const authService = {
  login: async (username: string, password: string): Promise<boolean> => {
    // Artificial delay to simulate network request
    await new Promise(resolve => setTimeout(resolve, 800));

    // Mock verification: In real app, this sends a POST to backend.
    // For now, we simulate a secure check.
    const isMockValid = username === 'admin' && password === 'admin';
    
    if (isMockValid) {
      // Typically you'd store the session/jwt token securely here
      return true;
    }
    
    return false;
  },

  logout: () => {
    // Clear tokens, session, etc.
  }
};
