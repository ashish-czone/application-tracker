const path = require('path');
const nodeExternals = require('webpack-node-externals');
const { buildPackageAliases, buildDomainAliases } = require('../../packages/webpack-aliases.cjs');

module.exports = function (options) {
  return {
    ...options,
    entry: {
      main: './src/main.ts',
      'cli/seed': './src/cli/seed.ts',
    },
    output: {
      ...options.output,
      filename: '[name].js',
    },
    externals: [
      nodeExternals({
        allowlist: [/^@packages\//, /^@domains\//],
        modulesDir: path.resolve(__dirname, '../../node_modules'),
        additionalModuleDirs: [path.resolve(__dirname, 'node_modules')],
      }),
      { bcrypt: 'commonjs bcrypt', sharp: 'commonjs sharp' },
    ],
    resolve: {
      ...options.resolve,
      modules: [
        'node_modules',
        path.resolve(__dirname, '../../node_modules'),
      ],
      alias: {
        ...buildPackageAliases(path.resolve(__dirname, '../../packages')),
        ...buildDomainAliases(path.resolve(__dirname, '../../domains')),
      },
    },
  };
};
