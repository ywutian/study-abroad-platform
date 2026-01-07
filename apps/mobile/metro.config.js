const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Get the monorepo root
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Add support for path aliases
config.resolver.alias = {
  '@': path.resolve(projectRoot, 'src'),
  '@components': path.resolve(projectRoot, 'src/components'),
  '@screens': path.resolve(projectRoot, 'src/screens'),
  '@hooks': path.resolve(projectRoot, 'src/hooks'),
  '@lib': path.resolve(projectRoot, 'src/lib'),
  '@stores': path.resolve(projectRoot, 'src/stores'),
  '@utils': path.resolve(projectRoot, 'src/utils'),
  '@types': path.resolve(projectRoot, 'src/types'),
};

// 4. Disable package exports
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
