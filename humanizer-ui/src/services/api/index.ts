/**
 * API Services Index
 * Centralized export of all API services
 */

export * from './client';
export * from './archive';
export * from './gutenberg';
export * from './transformations';
export * from './postSocial';

import { useApiClients } from './client';
import { ArchiveService } from './archive';
import { GutenbergService } from './gutenberg';
import { TransformationService } from './transformations';
import { PostSocialService } from './postSocial';

/**
 * Hook to get all API services for current environment
 */
export function useServices() {
  const clients = useApiClients();

  return {
    archive: clients.archive ? new ArchiveService(clients.archive) : null,
    gutenberg: new GutenbergService(clients.npe),
    transformations: new TransformationService(clients.npe),
    postSocial: new PostSocialService(clients.postSocial),
  };
}
