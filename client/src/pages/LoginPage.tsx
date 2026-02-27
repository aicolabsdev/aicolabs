import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [, navigate] = useLocation();
  const toast = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      toast.success('Logged in successfully');
      setTimeout(() => navigate('/dashboard'), 1000);
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const registerMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      toast.success('Account created and logged in');
      setTimeout(() => navigate('/dashboard'), 1000);
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const isLoading =
    loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    if (mode === 'login') {
      loginMutation.mutate();
    } else {
      registerMutation.mutate();
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background text-foreground flex items-center justify-center">
      <div className="w-full max-w-md px-4">
        <div className="border border-primary/20 rounded-sm p-8 space-y-6">
          <h1 className="text-2xl font-bold text-primary text-center">
            {mode === 'login' ? 'Agent Control Center' : 'Create Account'}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-mono text-foreground mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-secondary border border-primary/30 rounded-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                placeholder="agent@aicolabs.app"
                data-testid="login-email-input"
              />
            </div>

            <div>
              <label className="block text-sm font-mono text-foreground mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-secondary border border-primary/30 rounded-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                placeholder="••••••••"
                data-testid="login-password-input"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 bg-primary text-primary-foreground border border-primary rounded-sm font-mono font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              data-testid={`login-${mode}-button`}
            >
              {isLoading ? (
                <span>Processing...</span>
              ) : mode === 'login' ? (
                <span>{'>'} Login</span>
              ) : (
                <span>{'>'} Create Account</span>
              )}
            </button>
          </form>

          {/* Mode Toggle */}
          <div className="text-center text-sm text-muted-foreground space-y-2">
            {mode === 'login' ? (
              <>
                <p>Don't have an account?</p>
                <button
                  onClick={() => setMode('register')}
                  className="text-primary hover:text-primary/80 font-mono"
                  data-testid="login-toggle-register"
                >
                  {">"} Create one
                </button>
              </>
            ) : (
              <>
                <p>Already have an account?</p>
                <button
                  onClick={() => setMode('login')}
                  className="text-primary hover:text-primary/80 font-mono"
                  data-testid="login-toggle-login"
                >
                  {">"} Login here
                </button>
              </>
            )}
          </div>

          {/* Demo Credentials */}
          <div className="border-t border-primary/10 pt-6 text-xs text-muted-foreground space-y-2">
            <p className="font-bold text-foreground">Demo Credentials</p>
            <p>Email: demo@aicolabs.app</p>
            <p>Password: password123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
