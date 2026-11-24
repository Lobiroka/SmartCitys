const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Expo 57 observa todo .env*, mas seu transformer só interpreta estes nomes
// canônicos. Arquivos auxiliares da equipe já são carregados pelo script Node.
const unsupportedEnvFiles = /(^|[/\\])\.env(?!(?:\.(?:local|(?:development|production)(?:\.local)?))?$)[^/\\]*$/;
const previousBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(previousBlockList) ? previousBlockList : previousBlockList ? [previousBlockList] : []),
  unsupportedEnvFiles,
];

module.exports = withNativewind(config);
