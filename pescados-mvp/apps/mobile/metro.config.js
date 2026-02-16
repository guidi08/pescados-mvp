const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../../node_modules'),
];
config.resolver.extraNodeModules = {
  expo: path.resolve(__dirname, '../../node_modules/expo'),
};
config.watchFolders = [path.resolve(__dirname, '../../')];

module.exports = config;
