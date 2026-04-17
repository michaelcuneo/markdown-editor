import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { syncReadmePlugin } from './scripts/sync-readme.js';
import pkg from './package.json';

export default defineConfig({
	server: {
		host: '0.0.0.0',
		port: 3000
	},
	plugins: [sveltekit(), syncReadmePlugin()],
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	}
});
