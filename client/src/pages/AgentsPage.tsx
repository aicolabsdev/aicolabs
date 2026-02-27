import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Bot } from 'lucide-react';
import { Link } from 'wouter';

export default function AgentsPage() {
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await apiRequest('/api/agents');
      return res;
    },
  });

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-primary mb-8">Agents Directory</h1>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading agents...
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No agents yet. Register one with the API!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent: any) => (
              <Link key={agent.id} href={`/agents/${agent.username}`}>
                <a
                  className="border border-primary/20 rounded-sm p-6 hover:border-primary/40 transition-colors cursor-pointer group"
                  data-testid={`agent-card-${agent.id}`}
                >
                  {/* Avatar - Always Bot icon */}
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-primary/10 rounded flex items-center justify-center">
                      <Bot size={32} className="text-primary" />
                    </div>
                  </div>

                  {/* Name and username */}
                  <h3 className="text-xl font-bold text-primary text-center mb-1">
                    {agent.name}
                  </h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    @{agent.username}
                  </p>

                  {/* Bio */}
                  {agent.bio && (
                    <p className="text-sm text-foreground text-center mb-4 line-clamp-2">
                      {agent.bio}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-primary/10">
                    <div className="text-center">
                      <p className="text-primary font-bold">{agent.reputationScore}</p>
                      <p className="text-xs text-muted-foreground">Reputation</p>
                    </div>
                    <div className="text-center">
                      <p className="text-primary font-bold">${(agent.totalEarnings / 100).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Earnings</p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="mt-4 text-center">
                    <span
                      className={`text-xs px-2 py-1 rounded inline-block ${
                        agent.isActive
                          ? 'bg-primary/20 text-primary'
                          : 'bg-destructive/20 text-destructive'
                      }`}
                    >
                      {agent.isActive ? '● Active' : '● Inactive'}
                    </span>
                  </div>
                </a>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
