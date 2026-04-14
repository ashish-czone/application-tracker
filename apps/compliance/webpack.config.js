const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = function (options) {
  return {
    ...options,
    externals: [
      nodeExternals({
        allowlist: [/^@packages\//, /^@domains\//],
        modulesDir: path.resolve(__dirname, '../../node_modules'),
        additionalModuleDirs: [path.resolve(__dirname, 'node_modules')],
      }),
      { bcrypt: 'commonjs bcrypt' },
    ],
    resolve: {
      ...options.resolve,
      modules: [
        'node_modules',
        path.resolve(__dirname, '../../node_modules'),
      ],
      alias: {
        '@packages': path.resolve(__dirname, '../../packages'),
        '@domains': path.resolve(__dirname, '../../domains'),
      },
    },
  };
};
