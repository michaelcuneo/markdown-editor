import { Plugin } from 'prosemirror-state';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

export function imageDropPlugin(imageQueue: { id: string; file: File; previewUrl?: string }[]) {
	let counter = 0;
	let caretEl: HTMLDivElement | null = null;
	let draggingImg: HTMLElement | null = null;
	let dragInside = false;
	let caretTimeout: number | null = null;

	// --- Preview registration
	function registerPreview(id: string, file: File) {
		const previewUrl = URL.createObjectURL(file);
		imageQueue.push({ id, file, previewUrl });

		// Define a proper window interface with type-safe access
		const w = window as typeof window & {
			__imagePreviewMap?: Record<string, string>;
		};

		if (!w.__imagePreviewMap) {
			w.__imagePreviewMap = {};
		}

		w.__imagePreviewMap[id] = previewUrl;
	}

	// --- Insert a new image node
	function insertImage(view: EditorView, id: string, alt: string) {
		const { state, dispatch } = view;
		const imageNode = state.schema.nodes.image;
		if (!imageNode) {
			console.error('Image node is not defined in the schema.');
			return;
		}
		const node = imageNode.create({ src: id, alt });
		dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
	}

	// --- Handle dropped or pasted files
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

	// --- Create or update fake caret
	function showCaret(view: EditorView, x: number, y: number) {
		if (!caretEl) {
			caretEl = document.createElement('div');
			caretEl.className = 'pm-drop-caret';
			document.body.appendChild(caretEl);
		}

		const pos = view.posAtCoords({ left: x, top: y });
		if (!pos) return;

		const rect = view.coordsAtPos(pos.pos);
		caretEl.style.left = `${rect.left}px`;
		caretEl.style.top = `${rect.top}px`;
		caretEl.style.height = `${rect.bottom - rect.top}px`;
		caretEl.style.opacity = '1';

		// Reset cleanup timer
		if (caretTimeout) clearTimeout(caretTimeout);
		caretTimeout = window.setTimeout(() => hideCaret(), 1200);
	}

	// --- Hide caret safely
	function hideCaret(force = false) {
		if (!caretEl) return;
		caretEl.style.opacity = '0';
		if (force) {
			setTimeout(() => {
				caretEl?.remove();
				caretEl = null;
			}, 250);
		}
	}

	// --- Move an existing image node
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

	// --- Ensure cleanup no matter what
	function cleanupAll() {
		hideCaret(true);
		if (dragInside) dragInside = false;
		if (draggingImg) {
			draggingImg.classList.remove('pm-img-dragging');
			draggingImg = null;
		}
	}

	return new Plugin({
		props: {
			handleDOMEvents: {
				dragstart(view: EditorView, event: DragEvent) {
					const img = (event.target as HTMLElement)?.closest('img.pm-image');
					if (!img) return false;
					draggingImg = img as HTMLElement;
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
					hideCaret(true);
					dragInside = false;

					const coords = { left: event.clientX, top: event.clientY };
					const pos = view.posAtCoords(coords);
					if (!pos) return false;

					// Reorder existing image
					if (draggingImg) {
						const domPos = view.posAtDOM(draggingImg, 0);
						if (domPos) moveImageNode(view, domPos, pos.pos);
						cleanupAll();
						return true;
					}

					// Drop new image
					const files = Array.from(event.dataTransfer?.files ?? []);
					if (!files.length) return false;

					const tr = view.state.tr.setSelection(
						TextSelection.near(view.state.doc.resolve(pos.pos))
					);
					view.dispatch(tr);
					handleFiles(view, files);
					cleanupAll();
					return true;
				},

				dragend() {
					cleanupAll();
					return false;
				},

				paste(view: EditorView, event: ClipboardEvent) {
					const files = Array.from(event.clipboardData?.files ?? []);
					if (!files.length) return false;
					event.preventDefault();
					handleFiles(view, files);
					cleanupAll();
					return true;
				}
			}
		}
	});
}
