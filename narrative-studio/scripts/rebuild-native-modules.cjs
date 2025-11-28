/**
 * Rebuild native modules for Electron
 * This script runs after electron-builder packs the app
 */
const rebuild = require('@electron/rebuild');

exports.default = async function(context) {
  console.log('Rebuilding native modules for Electron...');

  try {
    await rebuild.rebuild({
      buildPath: context.appOutDir,
      electronVersion: context.electronPlatformName,
      arch: context.arch,
      // Only rebuild these modules
      onlyModules: ['better-sqlite3', 'sqlite-vec']
    });

    console.log('Native modules rebuilt successfully');
  } catch (error) {
    console.error('Failed to rebuild native modules:', error);
    throw error;
  }
};
