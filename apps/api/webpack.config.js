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
      // Native modules inside @packages/* must be externalized
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
        '@modules': path.resolve(__dirname, 'src/modules'),
      },
    },
  };
};
