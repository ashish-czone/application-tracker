const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = function (options) {
  return {
    ...options,
    externals: [
      nodeExternals({
        allowlist: [/^@packages\//, /^@modules\//],
        modulesDir: path.resolve(__dirname, '../../node_modules'),
      }),
    ],
    resolve: {
      ...options.resolve,
      alias: {
        '@packages': path.resolve(__dirname, '../../packages'),
        '@modules': path.resolve(__dirname, 'src/modules'),
      },
    },
  };
};
