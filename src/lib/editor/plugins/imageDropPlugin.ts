// src/lib/editor/plugins/imageDropPlugin.ts
import { Plugin } from 'prosemirror-state';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/**
 * Adds rich drag-and-drop behavior for images:
 * - Drop new files → inserts at caret w/ blob preview
 * - Drag existing images → reorders them inline (no duplicates)
 * - Shows live caret indicator
 */
export function imageDropPlugin(imageQueue: { id: string; file: File; previewUrl?: string }[]) {
	let counter = 0;
	let caretEl: HTMLDivElement | null = null;
	let draggingImg: HTMLElement | null = null;
	let dragInside = false;

	// 🧠 Register preview + blob URL for rendering
	function registerPreview(id: string, file: File) {
		const previewUrl = URL.createObjectURL(file);
		imageQueue.push({ id, file, previewUrl });
		(window as { __imagePreviewMap?: Record<string, string> }).__imagePreviewMap ||= {};
		(window as unknown as { __imagePreviewMap: Record<string, string> }).__imagePreviewMap[id] =
			previewUrl;
	}

	// 🧠 Insert new image node into doc
	function insertImage(view: EditorView, id: string, alt: string) {
		const { state, dispatch } = view;
		const node = state.schema.nodes.image.create({ src: id, alt });
		dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
	}

	// 🧠 Handle file drops / pastes
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

	// 🧠 Render fake caret line
	function showCaret(view: EditorView, x: number, y: number) {
		if (!caretEl) {
			caretEl = document.createElement('div');
			caretEl.className = 'pm-drop-caret';
			document.body.appendChild(caretEl);
		}
		const coords = { left: x, top: y };
		const pos = view.posAtCoords(coords);
		if (!pos) return;
		const rect = view.coordsAtPos(pos.pos);
		caretEl.style.left = `${rect.left}px`;
		caretEl.style.top = `${rect.top}px`;
		caretEl.style.height = `${rect.bottom - rect.top}px`;
		caretEl.style.opacity = '1';
	}

	function hideCaret() {
		if (caretEl) caretEl.style.opacity = '0';
	}

	// 🧠 Move existing image node
	function moveImageNode(view: EditorView, fromPos: number, toPos: number) {
		const { state, dispatch } = view;
		const node = state.doc.nodeAt(fromPos);
		if (!node || node.type.name !== 'image') return false;

		const tr = state.tr.delete(fromPos, fromPos + node.nodeSize);
		const insertPos = toPos > fromPos ? toPos - node.nodeSize : toPos;
		tr.insert(insertPos, node);
		dispatch(tr.scrollIntoView());
		return true;
	}

	return new Plugin({
		props: {
			handleDOMEvents: {
				// === Start dragging an existing image ===
				dragstart(view: EditorView, event: DragEvent) {
					const img = (event.target as HTMLElement)?.closest('img.pm-image');
					if (!img) return false;
					if (img instanceof HTMLElement) {
						draggingImg = img;
					}
					img.classList.add('pm-img-dragging');
					event.dataTransfer?.setData('text/plain', 'pm-image-drag');
					event.dataTransfer!.effectAllowed = 'move';
					return true;
				},

				dragover(view: EditorView, event: DragEvent) {
					event.preventDefault();

					const hasImage =
						draggingImg ||
						Array.from(event.dataTransfer?.items || []).some((i) => i.type.startsWith('image/'));
					if (!hasImage) return false;

					showCaret(view, event.clientX, event.clientY);

					if (!dragInside) {
						view.dom.classList.add('pm-dragging-image');
						dragInside = true;
					}
					return true;
				},

				dragleave(view: EditorView) {
					view.dom.classList.remove('pm-dragging-image');
					hideCaret();
					dragInside = false;
					return false;
				},

				drop(view: EditorView, event: DragEvent) {
					event.preventDefault();
					view.dom.classList.remove('pm-dragging-image');
					hideCaret();
					dragInside = false;

					const coords = { left: event.clientX, top: event.clientY };
					const pos = view.posAtCoords(coords);
					if (!pos) return false;

					// === Case 1: Moving an existing image ===
					if (draggingImg) {
						const domPos = view.posAtDOM(draggingImg, 0);
						if (!domPos) return false;
						moveImageNode(view, domPos, pos.pos);
						draggingImg.classList.remove('pm-img-dragging');
						draggingImg = null;
						return true;
					}

					// === Case 2: Dropping a new image file ===
					const files = Array.from(event.dataTransfer?.files ?? []);
					if (!files.length) return false;

					const tr = view.state.tr.setSelection(
						TextSelection.near(view.state.doc.resolve(pos.pos))
					);
					view.dispatch(tr);
					return handleFiles(view, files);
				},

				dragend() {
					if (draggingImg) {
						draggingImg.classList.remove('pm-img-dragging');
						draggingImg = null;
					}
					hideCaret();
					dragInside = false;
					return false;
				},

				paste(view: EditorView, event: ClipboardEvent) {
					const files = Array.from(event.clipboardData?.files ?? []);
					if (!files.length) return false;
					event.preventDefault();
					return handleFiles(view, files);
				}
			}
		}
	});
}
