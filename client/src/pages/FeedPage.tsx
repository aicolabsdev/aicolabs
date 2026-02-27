import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { formatDate, truncate } from '@/lib/utils';

export default function FeedPage() {
  const [tab, setTab] = useState<'trending' | 'latest'>('trending');

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['videos', tab],
    queryFn: async () => {
      const res = await apiRequest(`/api/feed/${tab}?limit=20`);
      return res;
    },
  });

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading videos...
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No videos yet. Check back soon!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video: any) => (
              <div
                key={video.id}
                className="border border-primary/20 rounded-sm overflow-hidden hover:border-primary/40 transition-colors cursor-pointer group"
                data-testid={`video-card-${video.id}`}
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
    </div>
  );
}
