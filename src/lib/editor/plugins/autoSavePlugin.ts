import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

declare module 'prosemirror-view' {
	interface EditorView {
		setMarkdown?: (markdown: string) => void;
		getMarkdown?: () => string;
	}
}

export const autoSaveKey = new PluginKey('auto-save');

export type ImageQueueItem = {
	id: string;
	file?: File;
	name?: string;
	type?: string;
	size?: number;
	previewUrl?: string;
	srcSet?: string;
	quality?: number;
	optimizationSource?: 'sharpless' | 'canvas-fallback' | 'original-fallback' | 'pending';
	format?: string;
	variants?: Array<{
		label: string;
		format: string;
		width: number;
		height: number;
		size: number;
		url: string;
	}>;
	// [key: string]: any; // Removed for stricter typing
};

export type StoredImageQueueItem = {
	id: string;
	name?: string;
	type?: string;
	size?: number;
	previewUrl?: string;
	srcSet?: string;
	quality?: number;
	optimizationSource?: 'sharpless' | 'canvas-fallback' | 'original-fallback' | 'pending';
	format?: string;
};

export type AutoSaveOptions = {
	docId?: string;
	onSave?: (markdown: string, queue: Record<string, ImageQueueItem>) => void;
	onRestore?: (
		markdown: string,
		queue: Record<string, ImageQueueItem> | StoredImageQueueItem[]
	) => void;
	storageKey?: string;
	delay?: number;
};

type DebouncedFn<A extends unknown[]> = ((...args: A) => void) & {
	cancel: () => void;
};

type AutoSavePluginFactory = {
	(imageQueueRef: Record<string, ImageQueueItem>, options?: AutoSaveOptions): Plugin;
	clear: (storageKey?: string, docId?: string) => void;
	restore: (
		storageKey?: string,
		docId?: string
	) => { markdown: string; queue: StoredImageQueueItem[] } | null;
};

// ------------------------
// Utils
// ------------------------

function debounce<A extends unknown[]>(fn: (...args: A) => void, delay: number): DebouncedFn<A> {
	let timeout: ReturnType<typeof setTimeout> | null = null;

	const wrapped = (...args: A) => {
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(() => fn(...args), delay);
	};

	wrapped.cancel = () => {
		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
		}
	};

	return wrapped;
}

function getStorageKey(base: string, docId?: string): string {
	return docId ? `${base}:${docId}` : base;
}

// ------------------------
// Plugin
// ------------------------

export const autoSavePlugin: AutoSavePluginFactory = function autoSavePlugin(
	imageQueueRef: Record<string, ImageQueueItem>,
	options: AutoSaveOptions = {}
): Plugin {
	const { docId, onSave, storageKey = 'markdown-editor', delay = 500 } = options;

	const key = getStorageKey(storageKey, docId);

	return new Plugin({
		key: autoSaveKey,

		view(view: EditorView) {
			const save = debounce(() => {
				if (!view.getMarkdown) return;

				try {
					const markdown = view.getMarkdown();

					const queue: StoredImageQueueItem[] = Object.values(imageQueueRef).map((q) => ({
						id: q.id,
						name: q.name,
						type: q.type,
						size: q.size,
						previewUrl: q.previewUrl,
						srcSet: q.srcSet,
						quality: q.quality,
						optimizationSource: q.optimizationSource,
						format: q.format
					}));

					localStorage.setItem(key, JSON.stringify({ markdown, queue }));

					onSave?.(markdown, imageQueueRef);
				} catch {
					// ignore storage errors
				}
			}, delay);

			return {
				update() {
					save();
				},
				destroy() {
					save.cancel();
				}
			};
		}
	});
};

// Attach static methods after export
autoSavePlugin.clear = function clear(storageKey = 'markdown-editor', docId?: string): void {
	const key = docId ? `${storageKey}:${docId}` : storageKey;
	try {
		localStorage.removeItem(key);
	} catch {
		// ignore
	}
};

autoSavePlugin.restore = function restore(
	storageKey = 'markdown-editor',
	docId?: string
): { markdown: string; queue: StoredImageQueueItem[] } | null {
	const key = getStorageKey(storageKey, docId);
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { markdown: string; queue: StoredImageQueueItem[] };
		if (parsed?.markdown) return parsed;
	} catch {
		// ignore corrupted storage
	}
	return null;
};
