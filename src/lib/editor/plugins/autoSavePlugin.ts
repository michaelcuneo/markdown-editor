import { Plugin, PluginKey } from 'prosemirror-state';

declare module 'prosemirror-view' {
	interface EditorView {
		setMarkdown?: (markdown: string) => void;
		getMarkdown?: () => string;
	}
}
import { undoDepth, redoDepth } from 'prosemirror-history';

export const autoSaveKey = new PluginKey('auto-save');

function debounce<A extends unknown[]>(
	fn: (...args: A) => void,
	delay = 800
): (...args: A) => void {
	let timeout: ReturnType<typeof setTimeout>;
	return (...args: A) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => fn(...args), delay);
	};
}

export function autoSavePlugin(
	imageQueueRef: { id: string; file: File; previewUrl?: string }[],
	options?: {
		docId?: string; // optional unique key for multi-doc setups
		onSave?: (markdown: string, queue: typeof imageQueueRef) => void;
		onRestore?: (markdown: string, queue: typeof imageQueueRef) => void;
		storageKey?: string;
		delay?: number;
	}
) {
	const baseKey = options?.storageKey ?? 'markdown-editor';
	const docId = options?.docId ?? 'default';
	const delay = options?.delay ?? 800;

	const storagePrefix = `${baseKey}-${docId}`;

	const contentKey = `${storagePrefix}-content-v1`;
	const imageKey = `${storagePrefix}-images-v1`;

	const debouncedSave = debounce((markdown: string) => {
		try {
			if (options?.onSave) {
				options.onSave(markdown, imageQueueRef);
				return;
			}

			localStorage.setItem(contentKey, markdown);
			localStorage.setItem(
				imageKey,
				JSON.stringify(
					imageQueueRef.map(({ id, file, previewUrl }) => ({
						id,
						name: file.name,
						type: file.type,
						size: file.size,
						previewUrl
					}))
				)
			);
			console.info(`💾 Auto-saved [${docId}] markdown + images`);
		} catch (err) {
			console.warn('⚠️ Auto-save failed:', err);
		}
	}, delay);

	function restoreSaved() {
		let markdown = '';
		let queue: typeof imageQueueRef = [];

		try {
			markdown = localStorage.getItem(contentKey) || '';
			const savedImages = localStorage.getItem(imageKey);
			queue = savedImages ? JSON.parse(savedImages) : [];
		} catch (err) {
			console.warn('⚠️ Failed to restore saved content:', err);
		}

		if (queue?.length) {
			imageQueueRef.splice(0, imageQueueRef.length, ...queue);
		}

		if (options?.onRestore) options.onRestore(markdown, queue);

		return markdown;
	}

	let restored = false;

	return new Plugin({
		key: autoSaveKey,

		view(view) {
			if (!restored) {
				const saved = restoreSaved();
				if (saved && typeof view['setMarkdown'] === 'function') {
					view['setMarkdown'](saved);
					console.info(`🔄 Restored editor from localStorage [${docId}]`);
				}
				restored = true;
			}
			return {};
		},

		appendTransaction(transactions, oldState, newState) {
			if (!transactions.some((tr) => tr.docChanged)) return null;
			if (undoDepth(newState) !== 0 || redoDepth(newState) !== 0) return null;

			queueMicrotask(() => {
				try {
					const markdown = (newState.doc as { type?: unknown }).type
						? (
								window as {
									defaultMarkdownSerializer?: { serialize: (doc: typeof newState.doc) => string };
								}
							).defaultMarkdownSerializer?.serialize
							? (
									window as unknown as {
										defaultMarkdownSerializer?: { serialize: (doc: typeof newState.doc) => string };
									}
								).defaultMarkdownSerializer?.serialize(newState.doc)
							: newState.doc.textContent
						: '';

					if (markdown) debouncedSave(markdown);
				} catch (err) {
					console.warn('⚠️ Auto-save failed:', err);
				}
			});

			return null;
		}
	});
}

autoSavePlugin.clear = (storageKey = 'markdown-editor', docId?: string) => {
	const prefix = docId ? `${storageKey}-${docId}` : storageKey;
	for (const key in localStorage) {
		if (key.startsWith(prefix)) {
			localStorage.removeItem(key);
			console.info(`🧹 Cleared saved data: ${key}`);
		}
	}
};
