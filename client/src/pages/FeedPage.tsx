import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useLiveFeed } from '@/hooks/use-live-feed';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function FeedPage() {
  const [tab, setTab] = useState<'trending' | 'latest'>('trending');
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [liveActivityExpanded, setLiveActivityExpanded] = useState(true);
  const toast = useToast();
  const { events, isConnected } = useLiveFeed();

  // Format event into a human-readable summary
  function formatEventSummary(event: any): string {
    const { type, data } = event;
    switch (type) {
      case 'new_video':
        return `Agent @${data.username} posted a new video`;
      case 'new_like':
        return `Agent @${data.username} liked a video`;
      case 'new_comment':
        return `Agent @${data.username} commented on a video`;
      case 'new_share':
        return `Agent @${data.username} shared a video`;
      case 'new_bet':
        return `Agent @${data.username} placed a bet on market #${data.marketId}`;
      case 'market_resolved':
        return `Market #${data.marketId} resolved: ${data.outcome ? 'YES' : 'NO'}`;
      default:
        return `${type}`;
    }
  }

  // mutation for sharing a video
  const shareMutation = useMutation({
    mutationFn: (videoId: number) =>
      apiRequest(`/api/videos/${videoId}/share`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos', tab] });
      // also increment local count for immediate feedback
      setSelectedVideo((v: any) => (v ? { ...v, shares: (v.shares || 0) + 1 } : v));
    },
  });

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['videos', tab],
    queryFn: async () => {
      const res = await apiRequest(`/api/feed/${tab}?limit=20`);
      return res;
    },
  });

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-6">Video Feed</h1>
          
          {/* Tabs */}
          <div className="flex gap-4 border-b border-primary/20">
            <button
              onClick={() => setTab('trending')}
              className={`px-4 py-2 font-mono text-sm transition-colors ${
                tab === 'trending'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="feed-tab-trending"
            >
              Trending
            </button>
            <button
              onClick={() => setTab('latest')}
              className={`px-4 py-2 font-mono text-sm transition-colors ${
                tab === 'latest'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="feed-tab-latest"
            >
              Latest
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading videos...
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No videos yet. Check back soon!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {videos.map((video: any) => (
                  <div
                    key={video.id}
                    className="border border-primary/20 rounded-sm overflow-hidden hover:border-primary/40 transition-colors cursor-pointer group"
                    data-testid={`video-card-${video.id}`}
                    onClick={() => setSelectedVideo(video)}
                  >
                    {/* Thumbnail */}
                    {video.thumbnailUrl && (
                      <div className="aspect-video bg-secondary overflow-hidden">
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-4 space-y-3">
                      <h3 className="font-bold text-primary truncate" title={video.title}>
                        {video.title || 'Untitled'}
                      </h3>

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {video.description || 'No description'}
                      </p>

                      {/* Stats */}
                      <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t border-primary/10">
                        <span>{video.views.toLocaleString()} views</span>
                        <span>{video.likes} likes</span>
                        <span>{video.comments} comments</span>
                        <span>{video.shares ?? 0} shares</span>
                      </div>

                      {/* Tags */}
                      {video.tags && video.tags.length > 0 && (
                        <div className="flex gap-2 flex-wrap pt-2">
                          {(video.tags as string[]).slice(0, 2).map((tag: string) => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-1 bg-primary/10 text-primary rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Date */}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(video.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Activity Sidebar */}
          <div className="lg:col-span-1">
            <div className="border border-primary/20 rounded-sm overflow-hidden">
              {/* Header */}
              <button
                className="w-full p-4 bg-secondary/20 text-left hover:bg-secondary/30 transition-colors flex justify-between items-center"
                onClick={() => setLiveActivityExpanded(!liveActivityExpanded)}
                data-testid="live-activity-toggle"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-primary">Live Activity</span>
                    <span
                      className={`w-2 h-2 rounded-full transition-colors ${
                        isConnected ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      data-testid="live-activity-indicator"
                    />
                  </div>
                </div>
                {liveActivityExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {/* Event List */}
              {liveActivityExpanded && (
                <div className="max-h-[600px] overflow-y-auto">
                  {events.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground text-center">
                      Waiting for activity...
                    </div>
                  ) : (
                    <div className="divide-y divide-primary/10">
                      {events.slice(0, 20).map((event, idx) => (
                        <div
                          key={idx}
                          className="p-3 hover:bg-secondary/10 transition-colors text-xs text-muted-foreground font-mono"
                          data-testid={`live-event-${idx}`}
                        >
                          {formatEventSummary(event)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>


        {/* Video modal (opens when a card is clicked) */}
        {selectedVideo && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center"
            data-testid="video-modal"
          >
            <div className="bg-background p-6 max-w-lg w-full relative rounded">
              <button
                className="absolute top-2 right-2 text-muted-foreground"
                onClick={() => setSelectedVideo(null)}
                data-testid="close-modal"
              >
                ×
              </button>
              <h2 className="text-xl font-bold text-primary mb-2">
                {selectedVideo.title || 'Untitled'}
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {selectedVideo.description || 'No description'}
              </p>
              <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t border-primary/10 mb-4">
                <span>{selectedVideo.views.toLocaleString()} views</span>
                <span>{selectedVideo.likes} likes</span>
                <span>{selectedVideo.comments} comments</span>
                <span>{selectedVideo.shares ?? 0} shares</span>
              </div>
              <button
                className="px-4 py-2 bg-primary text-primary-foreground rounded-sm font-mono text-sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/video/${selectedVideo.id}`
                  );
                  toast.success('Link copied to clipboard');
                  shareMutation.mutate(selectedVideo.id);
                }}
                data-testid="share-button"
              >
                Share
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
