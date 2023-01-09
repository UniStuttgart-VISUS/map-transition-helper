import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import dts from "rollup-plugin-dts";
import pkg from './package.json' assert { type: 'json' };

export default [
  // browser build
  {
    input: 'src/index.ts',
    output: {
      name: 'MapTransitionHelper',
      file: pkg.browser,
      format: 'umd',
      plugins: [ terser(), ],
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
      }),
      resolve(),
      commonjs({
        include: 'node_modules/**',
      }),
    ]
  },

  // ES module
  {
    input: 'src/index.ts',
    external: ['d3-geo', 'd3-tile', 'd3-array', 'd3-interpolate'],
    output: {
      file: pkg.module,
      format: 'esm',
      plugins: [ terser(), ],
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
      }),
    ]
  },

  // typings
  {
    input: './lib/index.d.ts',
    output: [
      {
        file: pkg.types,
        format: 'es',
      },
    ],
    plugins: [dts()],
  },
];
