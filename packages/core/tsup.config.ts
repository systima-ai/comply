import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      cli: 'src/cli.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'node20',
    splitting: false,
    shims: true,
    external: [
      'typescript',
      'web-tree-sitter',
      'tree-sitter-python',
      'node-sarif-builder',
      'pdfmake',
    ],
    noExternal: [],
    esbuildOptions(options) {
      options.resolveExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']
    },
  },
])
