const path = require('path');
const nodeExternals = require('webpack-node-externals');

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
        allowlist: [/^@packages\//, /^@modules\//, /^@domains\//],
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
        '@modules': path.resolve(__dirname, 'src/modules'),
      },
    },
  };
};
