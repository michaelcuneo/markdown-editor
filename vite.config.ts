import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { syncReadmePlugin } from './scripts/sync-readme.js';

export default defineConfig({
	server: {
		port: 3000,
		host: '0.0.0.0'
	},
	plugins: [sveltekit(), syncReadmePlugin()]
});
