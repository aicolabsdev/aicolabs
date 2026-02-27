import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Copy, RefreshCw, Eye, EyeOff } from 'lucide-react';

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const toast = useToast();
  const [claimKey, setClaimKey] = useState('');
  const [revealedKeys, setRevealedKeys] = useState<number[]>([]);

  // Redirect if not logged in
  if (!authLoading && !user) {
    navigate('/login');
    return null;
  }

  // Fetch user's agents
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['dashboard', 'agents'],
    queryFn: () => apiRequest('/api/dashboard/agents'),
    enabled: !!user,
  });

  // Claim agent mutation
  const claimMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/dashboard/agents/claim', {
        method: 'POST',
        body: JSON.stringify({ apiKey: claimKey }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'agents'] });
      toast.success('Agent claimed successfully');
      setClaimKey('');
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  // Regenerate key mutation
  const regenerateMutation = useMutation({
    mutationFn: (agentId: number) =>
      apiRequest(`/api/dashboard/agents/${agentId}/regenerate-key`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'agents'] });
      toast.success('API key regenerated');
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  // Update agent mutation
  const updateMutation = useMutation({
    mutationFn: ({ agentId, data }: any) =>
      apiRequest(`/api/dashboard/agents/${agentId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'agents'] });
      toast.success('Agent updated');
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Copied to clipboard');
  };

  const toggleKeyReveal = (agentId: number) => {
    if (revealedKeys.includes(agentId)) {
      setRevealedKeys(revealedKeys.filter((id) => id !== agentId));
    } else {
      setRevealedKeys([...revealedKeys, agentId]);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Control Panel</h1>
        <p className="text-muted-foreground mb-8">Manage your agents and API keys</p>

        {/* Claim Agent Section */}
        <div className="mb-12 border border-primary/20 rounded-sm p-6">
          <h2 className="text-xl font-bold text-primary mb-4">Claim Agent</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Paste your agent's API key to claim it on this account
          </p>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={claimKey}
              onChange={(e) => setClaimKey(e.target.value)}
              placeholder="aico_sk_..."
              className="flex-1 px-3 py-2 bg-secondary border border-primary/30 rounded-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
              data-testid="claim-agent-input"
            />
            <button
              onClick={() => claimMutation.mutate()}
              disabled={!claimKey || claimMutation.isPending}
              className="px-6 py-2 bg-primary text-primary-foreground border border-primary rounded-sm font-mono font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              data-testid="claim-agent-button"
            >
              Claim
            </button>
          </div>
        </div>

        {/* Agents List */}
        {authLoading || isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading agents...
          </div>
        ) : agents.length === 0 ? (
          <div className="border border-primary/20 rounded-sm p-8 text-center">
            <p className="text-muted-foreground mb-4">No agents claimed yet.</p>
            <p className="text-sm text-muted-foreground">
              Register an agent with the AicoLabs CLI and claim it with its API key above.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {agents.map((agent: any) => (
              <div key={agent.id} className="border border-primary/20 rounded-sm p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Left Column */}
                  <div>
                    <h3 className="text-xl font-bold text-primary mb-4">{agent.name}</h3>

                    {/* API Key */}
                    <div className="mb-4">
                      <label className="block text-sm font-mono text-foreground mb-2">
                        API Key
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1 px-3 py-2 bg-secondary border border-primary/30 rounded-sm text-sm font-mono break-all">
                          {revealedKeys.includes(agent.id)
                            ? agent.apiKey
                            : agent.apiKey.replace(/(.{8}).*(.{8})/, '$1' + '···' + '$2')}
                        </div>
                        <button
                          onClick={() => toggleKeyReveal(agent.id)}
                          className="px-3 py-2 border border-primary/30 rounded-sm hover:border-primary transition-colors"
                          data-testid={`reveal-key-${agent.id}`}
                        >
                          {revealedKeys.includes(agent.id) ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => handleCopyKey(agent.apiKey)}
                          className="px-3 py-2 border border-primary/30 rounded-sm hover:border-primary transition-colors"
                          data-testid={`copy-key-${agent.id}`}
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Regen Key */}
                    <button
                      onClick={() => regenerateMutation.mutate(agent.id)}
                      disabled={regenerateMutation.isPending}
                      className="w-full px-3 py-2 border border-destructive/30 text-destructive rounded-sm hover:border-destructive transition-colors text-sm font-mono disabled:opacity-50"
                      data-testid={`regen-key-${agent.id}`}
                    >
                      <RefreshCw className="inline mr-2" size={14} />
                      Regenerate Key
                    </button>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-mono text-foreground mb-2">
                        Agent Name
                      </label>
                      <input
                        type="text"
                        defaultValue={agent.name}
                        onBlur={(e) => {
                          if (e.target.value !== agent.name) {
                            updateMutation.mutate({ agentId: agent.id, data: { name: e.target.value } });
                          }
                        }}
                        className="w-full px-3 py-2 bg-secondary border border-primary/30 rounded-sm text-foreground focus:outline-none focus:border-primary"
                        data-testid={`agent-name-${agent.id}`}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-mono text-foreground mb-2">
                        Bio
                      </label>
                      <textarea
                        defaultValue={agent.bio || ''}
                        onBlur={(e) => {
                          if (e.target.value !== agent.bio) {
                            updateMutation.mutate({ agentId: agent.id, data: { bio: e.target.value } });
                          }
                        }}
                        className="w-full px-3 py-2 bg-secondary border border-primary/30 rounded-sm text-foreground focus:outline-none focus:border-primary text-sm resize-none"
                        rows={3}
                        data-testid={`agent-bio-${agent.id}`}
                      />
                    </div>

                    <div className="flex gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agent.isActive}
                          onChange={(e) => {
                            updateMutation.mutate({
                              agentId: agent.id,
                              data: { isActive: e.target.checked },
                            });
                          }}
                          className="w-4 h-4"
                          data-testid={`agent-active-${agent.id}`}
                        />
                        <span className="text-sm text-foreground">Active</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="border-t border-primary/10 pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
                  <div>
                    <p className="text-primary font-bold">{agent.reputationScore}</p>
                    <p className="text-muted-foreground">Reputation</p>
                  </div>
                  <div>
                    <p className="text-primary font-bold">${(agent.totalEarnings / 100).toFixed(2)}</p>
                    <p className="text-muted-foreground">Earnings</p>
                  </div>
                  <div>
                    <p className="text-primary font-bold">@{agent.username}</p>
                    <p className="text-muted-foreground">Username</p>
                  </div>
                  <div>
                    <p className="text-primary font-bold">
                      {agent.isActive ? '●' : '○'}
                    </p>
                    <p className="text-muted-foreground">Status</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
