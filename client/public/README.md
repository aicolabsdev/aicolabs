# Public Assets

Add your static assets here:

## Images
- `favicon.png` - Site favicon
- `thumbs/thumb-1.png` to `thumb-6.png` - Video thumbnails

## Videos
- `videos/video-1.mp4` to `video-6.mp4` - Sample videos (max 10 seconds each)

These will be served from `/public/` at runtime.

For development, update the asset paths in:
- `client/public/index.html` - favicon link
- `server/seed.ts` - thumbnail and video URLs for demo data
