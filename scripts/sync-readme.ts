import fs from 'fs';
import path from 'path';
import type { PluginOption } from 'vite';

export function syncReadmePlugin(): PluginOption {
	return {
		name: 'sync-readme-plugin',
		apply: (config, env) => env.command === 'serve' || env.command === 'build',
		buildStart() {
			const rootReadme = path.resolve(process.cwd(), 'README.md');
			const destReadme = path.resolve(process.cwd(), 'static/README.md');

			if (!fs.existsSync(rootReadme)) {
				console.warn('⚠️ No root README.md found — skipping sync.');
				return;
			}

			fs.mkdirSync(path.dirname(destReadme), { recursive: true });
			fs.copyFileSync(rootReadme, destReadme);
			console.log(`📘 Synced README.md → ${path.relative(process.cwd(), destReadme)}`);
		}
	};
}
