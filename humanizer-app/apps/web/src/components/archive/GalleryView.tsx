/**
 * Gallery View - Media browser with images from archive
 *
 * Uses unified MediaGallery component from @humanizer/ui
 */

import {
  MediaGallery,
  useMediaGallery,
  type MediaSource,
} from '@humanizer/ui';

// Import the component CSS (should be in app's main CSS import)
// import '@humanizer/ui/styles/components/media.css';

const ARCHIVE_API = 'http://localhost:3002';

export function GalleryView() {
  const gallery = useMediaGallery({
    apiBaseUrl: ARCHIVE_API,
    initialSource: 'openai',
    pageSize: 50,
    autoLoad: true,
  });

  return (
    <MediaGallery
      items={gallery.items}
      total={gallery.total}
      hasMore={gallery.hasMore}
      loading={gallery.loading}
      error={gallery.error}
      source={gallery.source}
      availableSources={['openai', 'facebook']}
      searchQuery={gallery.searchQuery}
      onSourceChange={gallery.setSource}
      onSearchChange={gallery.setSearchQuery}
      onLoadMore={gallery.loadMore}
      useLightbox={true}
      config={{
        viewMode: 'grid',
        showMetadataOnHover: true,
        pageSize: 50,
      }}
    />
  );
}
