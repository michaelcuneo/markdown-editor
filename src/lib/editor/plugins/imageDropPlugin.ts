// src/lib/editor/plugins/imageDropPlugin.ts
import { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/**
 * Handles dropped or pasted images:
 *  - Inserts a real <img> node at caret.
 *  - Adds entry to the Svelte imageQueue ({id,file,previewUrl}).
 *  - Preview appears instantly via __imagePreviewMap.
 */
export function imageDropPlugin(imageQueue: { id: string; file: File; previewUrl?: string }[]) {
	let counter = 0;

	function registerPreview(id: string, file: File) {
		const previewUrl = URL.createObjectURL(file);
		imageQueue.push({ id, file, previewUrl });

		interface WindowWithImagePreviewMap extends Window {
			__imagePreviewMap?: Record<string, string>;
		}
		const typedWindow = window as WindowWithImagePreviewMap;
		typedWindow.__imagePreviewMap ||= {};
		typedWindow.__imagePreviewMap[id] = previewUrl;
	}

	function insertImage(view: EditorView, id: string, alt: string) {
		const { state, dispatch } = view;
		const { schema } = state;
		const node = schema.nodes.image.create({ src: id, alt });
		dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
	}

	function handleFiles(view: EditorView, files: File[]) {
		for (const file of files) {
			if (!file.type.startsWith('image/')) continue;
			const id = `local-img-${++counter}`;
			const alt = file.name.replace(/\.[^.]+$/, '');
			registerPreview(id, file);
			insertImage(view, id, alt);
		}
		return true;
	}

	return new Plugin({
		props: {
			handleDrop(view, event) {
				const files = Array.from(event.dataTransfer?.files ?? []);
				if (!files.length) return false;
				event.preventDefault();
				return handleFiles(view, files);
			},
			handlePaste(view, event) {
				const files = Array.from(event.clipboardData?.files ?? []);
				if (!files.length) return false;
				event.preventDefault();
				return handleFiles(view, files);
			}
		}
	});
}
