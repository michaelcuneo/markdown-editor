import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { syncReadmePlugin } from './scripts/sync-readme.js';

export default defineConfig({
	plugins: [sveltekit(), syncReadmePlugin()]
});
