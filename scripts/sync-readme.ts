import fs from 'fs';
import path from 'path';
import type { PluginOption } from 'vite';

export function syncReadmePlugin(): PluginOption {
	return {
		name: 'sync-readme-plugin',
		apply: (config, env) => env.command === 'serve' || env.command === 'build',

		buildStart() {
			const cwd = process.cwd();

			const rootReadme = path.resolve(cwd, 'README.md');
			const destReadme = path.resolve(cwd, 'static/README.md');

			const rootChangelog = path.resolve(cwd, 'CHANGELOG.md');
			const destChangelog = path.resolve(cwd, 'static/CHANGELOG.md');

			const rootPkg = path.resolve(cwd, 'package.json');
			const frontendVersionTs = path.resolve(cwd, 'src/lib/version.ts');

			// --- VERSION SYNC ---
			if (fs.existsSync(rootPkg)) {
				const pkg = JSON.parse(fs.readFileSync(rootPkg, 'utf8'));
				const version = pkg.version;

				if (!version || typeof version !== 'string') {
					throw new Error('package.json is missing a valid version');
				}

				fs.mkdirSync(path.dirname(frontendVersionTs), { recursive: true });

				fs.writeFileSync(frontendVersionTs, `export const VERSION = "${version}";\n`);

				console.log(`🔖 Synced version → ${version}`);
			} else {
				console.warn('⚠️ No package.json found — skipping version sync.');
			}

			// --- CHANGELOG SYNC ---
			if (fs.existsSync(rootChangelog)) {
				fs.mkdirSync(path.dirname(destChangelog), { recursive: true });
				fs.copyFileSync(rootChangelog, destChangelog);
				console.log(`📘 Synced CHANGELOG.md → ${path.relative(cwd, destChangelog)}`);
			} else {
				console.warn('⚠️ No root CHANGELOG.md found — skipping sync.');
			}

			// --- README SYNC ---
			if (fs.existsSync(rootReadme)) {
				fs.mkdirSync(path.dirname(destReadme), { recursive: true });
				fs.copyFileSync(rootReadme, destReadme);
				console.log(`📘 Synced README.md → ${path.relative(cwd, destReadme)}`);
			} else {
				console.warn('⚠️ No root README.md found — skipping sync.');
			}
		}
	};
}
