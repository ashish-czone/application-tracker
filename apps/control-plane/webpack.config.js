const path = require('path');
const nodeExternals = require('webpack-node-externals');
const { buildPackageAliases } = require('../../packages/webpack-aliases.cjs');

module.exports = function (options) {
  return {
    ...options,
    externals: [
      nodeExternals({
        allowlist: [/^@packages\//, /^@modules\//],
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
        '@modules': path.resolve(__dirname, 'src/modules'),
      },
    },
  };
};
