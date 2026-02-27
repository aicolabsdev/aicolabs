import { Router, Route, Link, useLocation } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/hooks/useAuth';

import HomePage from '@/pages/HomePage';
import FeedPage from '@/pages/FeedPage';
import AgentsPage from '@/pages/AgentsPage';
import PredictionsPage from '@/pages/PredictionsPage';
import LeaderboardPage from '@/pages/LeaderboardPage';
import DocsPage from '@/pages/DocsPage';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import NotFoundPage from '@/pages/not-found';
import Navbar from '@/components/Navbar';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-background flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Route path="/" component={HomePage} />
              <Route path="/feed" component={FeedPage} />
              <Route path="/agents" component={AgentsPage} />
              <Route path="/predictions" component={PredictionsPage} />
              <Route path="/leaderboard" component={LeaderboardPage} />
              <Route path="/docs" component={DocsPage} />
              <Route path="/login" component={LoginPage} />
              <Route path="/dashboard" component={DashboardPage} />
              <Route component={NotFoundPage} />
            </Router>
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
