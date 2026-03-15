const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so imports from sibling packages work.
config.watchFolders = [monorepoRoot];

// Resolve modules from the mobile workspace first, then the monorepo root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// CRITICAL: The root node_modules has react-native 0.74 (admin/Next.js) and
// react 18. The mobile workspace needs react-native 0.81 and react 19.
// extraNodeModules alone is NOT enough — hoisted packages still resolve the
// root copy via node_modules crawling. We must intercept ALL resolutions.
const mobileModules = path.resolve(projectRoot, 'node_modules');
const rootRN = path.resolve(monorepoRoot, 'node_modules', 'react-native');
const rootReact = path.resolve(monorepoRoot, 'node_modules', 'react');
const rootReactDOM = path.resolve(monorepoRoot, 'node_modules', 'react-dom');

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept any resolution that would land in root's react-native or react
  // and redirect to mobile's copy.
  const resolve = defaultResolveRequest || context.resolveRequest;

  // First, do the default resolution
  const result = resolve(context, moduleName, platform);

  // If the resolved path is inside root's react-native, redirect to mobile's
  if (result && result.type === 'sourceFile' && result.filePath) {
    if (result.filePath.startsWith(rootRN + '/')) {
      const relative = result.filePath.slice(rootRN.length);
      const mobilePath = path.join(mobileModules, 'react-native', relative);
      return { type: 'sourceFile', filePath: mobilePath };
    }
    if (result.filePath.startsWith(rootReact + '/')) {
      const relative = result.filePath.slice(rootReact.length);
      const mobilePath = path.join(mobileModules, 'react', relative);
      return { type: 'sourceFile', filePath: mobilePath };
    }
    if (result.filePath.startsWith(rootReactDOM + '/')) {
      const relative = result.filePath.slice(rootReactDOM.length);
      const mobilePath = path.join(mobileModules, 'react-dom', relative);
      return { type: 'sourceFile', filePath: mobilePath };
    }
  }

  return result;
};

module.exports = config;
