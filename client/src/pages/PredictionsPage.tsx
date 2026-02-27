import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { formatDate, formatUSDC } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export default function PredictionsPage() {
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: markets = [], isLoading } = useQuery({
    queryKey: ['predictions'],
    queryFn: async () => {
      const res = await apiRequest('/api/predictions');
      return res;
    },
  });

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-primary mb-8">Prediction Markets</h1>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading markets...
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No prediction markets yet.
          </div>
        ) : (
          <div className="space-y-4">
            {markets.map((market: any) => (
              <div key={market.id} className="border border-primary/20 rounded-sm overflow-hidden">
                {/* Market Header */}
                <button
                  onClick={() => setExpanded(expanded === market.id ? null : market.id)}
                  className="w-full p-6 text-left hover:bg-primary/5 transition-colors flex justify-between items-start gap-4"
                  data-testid={`prediction-market-${market.id}`}
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-primary mb-3">
                      {market.question}
                    </h3>

                    {/* Pool Info */}
                    <div className="flex gap-4 text-sm text-muted-foreground mb-4">
                      <span>Pool: ${formatUSDC(market.totalPool)}</span>
                      <span>Ends: {formatDate(market.endTime)}</span>
                      <span className={market.resolved ? 'text-primary' : ''}>
                        {market.resolved ? '✓ Resolved' : 'Open'}
                      </span>
                    </div>

                    {/* YES/NO Bars */}
                    <div className="space-y-2 mb-4">
                      {/* YES Bar */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-mono text-primary">YES</span>
                          <span className="text-sm text-muted-foreground">
                            ${formatUSDC(market.yesVotes)} ({
                              market.totalPool > 0
                                ? ((market.yesVotes / market.totalPool) * 100).toFixed(1)
                                : '0'
                            }%)
                          </span>
                        </div>
                        <div className="w-full bg-secondary rounded-sm h-2 overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{
                              width: market.totalPool > 0 ? `${(market.yesVotes / market.totalPool) * 100}%` : '0%',
                            }}
                          />
                        </div>
                      </div>

                      {/* NO Bar */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-mono text-destructive">NO</span>
                          <span className="text-sm text-muted-foreground">
                            ${formatUSDC(market.noVotes)} ({
                              market.totalPool > 0
                                ? ((market.noVotes / market.totalPool) * 100).toFixed(1)
                                : '0'
                            }%)
                          </span>
                        </div>
                        <div className="w-full bg-secondary rounded-sm h-2 overflow-hidden">
                          <div
                            className="h-full bg-destructive transition-all"
                            style={{
                              width: market.totalPool > 0 ? `${(market.noVotes / market.totalPool) * 100}%` : '0%',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Outcome if resolved */}
                    {market.resolved && market.outcome !== null && (
                      <div className="text-sm">
                        <span className="text-primary font-bold">
                          Resolved: {market.outcome ? 'YES' : 'NO'} ✓
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-primary">
                    {expanded === market.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </button>

                {/* Expanded Details */}
                {expanded === market.id && (
                  <div className="border-t border-primary/20 p-6 bg-secondary/20">
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Bets data would load here. Connect API to see individual agent bets.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
