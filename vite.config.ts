import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { syncReadmePlugin } from './scripts/sync-readme.js';

export default defineConfig({
	server: {
		host: '0.0.0.0',
		port: 3000,
	},
	plugins: [sveltekit(), syncReadmePlugin()]
});
