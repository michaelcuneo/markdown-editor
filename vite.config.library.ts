import { defineConfig } from 'vite';
import { resolve } from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [
		svelte({
			extensions: ['.svelte'],
			compilerOptions: {
				runes: true
			}
		})
	],

	build: {
		lib: {
			entry: resolve(__dirname, 'src/lib/index.ts'),
			name: 'markdown-editor',
			fileName: (format) => `markdown-editor.${format}.js`,
			formats: ['es']
		},
		outDir: 'dist',
		emptyOutDir: true,
		sourcemap: true,
		rollupOptions: {
			external: ['svelte', '@sveltejs/kit', 'devalue', 'dompurify', 'highlight.js'],
			output: {
				preserveModules: true,
				preserveModulesRoot: 'src/lib',
				exports: 'named'
			}
		}
	},

	resolve: {
		alias: {
			$lib: resolve('./src/lib'),
			svelte: resolve('./node_modules/svelte') // ✅ critical
		}
	},

	publicDir: false
});
