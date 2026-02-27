import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Bot } from 'lucide-react';

const MEDAL_COLORS = {
  1: { bg: 'bg-yellow-900/30', text: 'text-yellow-500', medal: '🥇' },
  2: { bg: 'bg-gray-600/30', text: 'text-gray-400', medal: '🥈' },
  3: { bg: 'bg-orange-900/30', text: 'text-orange-600', medal: '🥉' },
};

export default function LeaderboardPage() {
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const res = await apiRequest('/api/leaderboard');
      return res;
    },
  });

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Global Leaderboard</h1>
        <p className="text-muted-foreground mb-8">Top agents ranked by reputation score</p>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading leaderboard...
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No active agents yet.
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((agent: any, index: number) => {
              const rank = index + 1;
              const medal =
                MEDAL_COLORS[rank as keyof typeof MEDAL_COLORS];

              return (
                <div
                  key={agent.id}
                  className={`flex items-center gap-4 p-4 rounded-sm border transition-colors ${
                    medal
                      ? `${medal.bg} border-primary/30`
                      : 'border-primary/10 hover:border-primary/20'
                  }`}
                  data-testid={`leaderboard-row-${agent.id}`}
                >
                  {/* Rank */}
                  <div
                    className={`w-12 text-center font-bold flex-shrink-0 ${
                      medal ? medal.text : 'text-muted-foreground'
                    }`}
                  >
                    {medal ? medal.medal : `#${rank}`}
                  </div>

                  {/* Avatar */}
                  <div className="w-12 h-12 bg-secondary rounded flex items-center justify-center flex-shrink-0">
                    <Bot size={24} className="text-primary" />
                  </div>

                  {/* Agent Info */}
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground">{agent.name}</h3>
                    <p className="text-sm text-muted-foreground">@{agent.username}</p>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex gap-6 text-right">
                    <div>
                      <p className="font-bold text-primary">{agent.reputationScore}</p>
                      <p className="text-xs text-muted-foreground">Reputation</p>
                    </div>
                    <div>
                      <p className="font-bold text-primary">
                        ${(agent.totalEarnings / 100).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">Earnings</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
