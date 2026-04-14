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
};

export type StoredImageQueueItem = {
	id: string;
	name?: string;
	type?: string;
	size?: number;
	previewUrl?: string;
};

export type AutoSaveOptions = {
	docId?: string;
	onSave?: (markdown: string, queue: ImageQueueItem[]) => void;
	onRestore?: (
		markdown: string,
		queue: ImageQueueItem[] | StoredImageQueueItem[]
	) => void;
	storageKey?: string;
	delay?: number;
};

type DebouncedFn<A extends unknown[]> = ((...args: A) => void) & {
	cancel: () => void;
};

type AutoSavePluginFn = (
	imageQueueRef: ImageQueueItem[],
	options?: AutoSaveOptions
) => Plugin;

type AutoSavePluginFactory = AutoSavePluginFn & {
	clear: (storageKey?: string, docId?: string) => void;
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

export const autoSavePlugin: AutoSavePluginFactory = Object.assign(
	function autoSavePluginImpl(
		imageQueueRef: ImageQueueItem[],
		options: AutoSaveOptions = {}
	): Plugin {
		const {
			docId,
			onSave,
			onRestore,
			storageKey = 'markdown-editor',
			delay = 500
		} = options;

		const key = getStorageKey(storageKey, docId);

		return new Plugin({
			key: autoSaveKey,

			view(view: EditorView) {
				// ------------------------
				// Restore
				// ------------------------
				try {
					const raw = localStorage.getItem(key);
					if (raw) {
						const parsed = JSON.parse(raw) as {
							markdown: string;
							queue: StoredImageQueueItem[];
						};

						if (parsed?.markdown && view.setMarkdown) {
							view.setMarkdown(parsed.markdown);
						}

						if (parsed?.queue && Array.isArray(parsed.queue)) {
							imageQueueRef.splice(0, imageQueueRef.length, ...parsed.queue);
						}

						onRestore?.(parsed.markdown, parsed.queue);
					}
				} catch {
					// ignore corrupted storage
				}

				// ------------------------
				// Save (debounced)
				// ------------------------
				const save = debounce(() => {
					if (!view.getMarkdown) return;

					try {
						const markdown = view.getMarkdown();

						const queue: StoredImageQueueItem[] = imageQueueRef.map((q) => ({
							id: q.id,
							name: q.name,
							type: q.type,
							size: q.size,
							previewUrl: q.previewUrl
						}));

						localStorage.setItem(
							key,
							JSON.stringify({
								markdown,
								queue
							})
						);

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
	},
	{
		clear(storageKey = 'markdown-editor', docId?: string): void {
			const key = docId ? `${storageKey}:${docId}` : storageKey;
			try {
				localStorage.removeItem(key);
			} catch {
				// ignore
			}
		}
	}
);