import { Plugin, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

export function imageDropPlugin(imageQueue: { id: string; file: File; previewUrl?: string }[]) {
	let counter = 0;
	let caretEl: HTMLDivElement | null = null;
	let draggingImg: HTMLElement | null = null;
	let dragInside = false;
	let caretTimeout: number | null = null;

	function makeImageId() {
		counter += 1;
		return `local-img-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 10)}`;
	}

	function registerPreview(id: string, file: File) {
		const previewUrl = URL.createObjectURL(file);
		imageQueue.push({ id, file, previewUrl });

		const w = window as typeof window & {
			__imagePreviewMap?: Record<string, string>;
		};

		if (!w.__imagePreviewMap) {
			w.__imagePreviewMap = {};
		}

		w.__imagePreviewMap[id] = previewUrl;
		return previewUrl;
	}

	function insertImage(view: EditorView, src: string, alt: string) {
		const imageNode = view.state.schema.nodes.image;
		if (!imageNode) {
			console.error('Image node is not defined in the schema.');
			return false;
		}

		const node = imageNode.create({ src, alt });
		view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
		return true;
	}

	function handleFiles(view: EditorView, files: File[]) {
		const imageFiles = files.filter((file) => file.type.startsWith('image/'));
		if (!imageFiles.length) return false;

		for (const file of imageFiles) {
			const id = makeImageId();
			const alt = file.name.replace(/\.[^.]+$/, '');
			const previewUrl = registerPreview(id, file);
			insertImage(view, previewUrl, alt);
		}

		return true;
	}

	function ensureCaret() {
		if (caretEl) return caretEl;

		caretEl = document.createElement('div');
		caretEl.className = 'pm-drop-caret';
		document.body.appendChild(caretEl);

		return caretEl;
	}

	function showCaret(view: EditorView, x: number, y: number) {
		const pos = view.posAtCoords({ left: x, top: y });
		if (!pos) return;

		const el = ensureCaret();
		const rect = view.coordsAtPos(pos.pos);

		el.style.left = `${rect.left}px`;
		el.style.top = `${rect.top}px`;
		el.style.height = `${rect.bottom - rect.top}px`;
		el.style.opacity = '1';

		if (caretTimeout) clearTimeout(caretTimeout);
		caretTimeout = window.setTimeout(() => {
			if (caretEl) caretEl.style.opacity = '0';
		}, 1200);
	}

	function hideCaret(force = false) {
		if (!caretEl) return;

		caretEl.style.opacity = '0';

		if (caretTimeout) {
			clearTimeout(caretTimeout);
			caretTimeout = null;
		}

		if (force) {
			caretEl.remove();
			caretEl = null;
		}
	}

	function moveImageNode(view: EditorView, fromPos: number, toPos: number) {
		const { state } = view;
		const node = state.doc.nodeAt(fromPos);
		if (!node || node.type.name !== 'image') return false;

		if (toPos >= fromPos && toPos <= fromPos + node.nodeSize) return false;

		const tr = state.tr.delete(fromPos, fromPos + node.nodeSize);
		const insertPos = toPos > fromPos ? toPos - node.nodeSize : toPos;

		try {
			tr.insert(insertPos, node);
			view.dispatch(tr.scrollIntoView());
			return true;
		} catch {
			return false;
		}
	}

	function cleanupAll(view?: EditorView) {
		hideCaret(true);
		dragInside = false;

		if (view) {
			view.dom.classList.remove('pm-dragging-image');
		}

		if (draggingImg) {
			draggingImg.classList.remove('pm-img-dragging');
			draggingImg = null;
		}
	}

	return new Plugin({
		props: {
			handleDOMEvents: {
				dragstart(view: EditorView, event: DragEvent) {
					const img = (event.target as HTMLElement | null)?.closest('img.pm-image');
					if (!img) return false;

					draggingImg = img as HTMLElement;
					draggingImg.classList.add('pm-img-dragging');

					if (event.dataTransfer) {
						event.dataTransfer.setData('text/plain', 'pm-image-drag');
						event.dataTransfer.effectAllowed = 'move';
					}

					return true;
				},

				dragover(view: EditorView, event: DragEvent) {
					const hasImage =
						!!draggingImg ||
						Array.from(event.dataTransfer?.items ?? []).some((i) => i.type.startsWith('image/'));

					if (!hasImage) return false;

					event.preventDefault();
					showCaret(view, event.clientX, event.clientY);

					if (!dragInside) {
						view.dom.classList.add('pm-dragging-image');
						dragInside = true;
					}

					return true;
				},

				dragleave(view: EditorView, event: DragEvent) {
					const next = event.relatedTarget as Node | null;
					if (next && view.dom.contains(next)) return false;

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

					const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
					if (!pos) {
						cleanupAll(view);
						return false;
					}

					if (draggingImg) {
						const fromPos = view.posAtDOM(draggingImg, 0);
						moveImageNode(view, fromPos, pos.pos);
						cleanupAll(view);
						return true;
					}

					const files = Array.from(event.dataTransfer?.files ?? []);
					if (!files.length) {
						cleanupAll(view);
						return false;
					}

					view.dispatch(
						view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos.pos)))
					);

					const handled = handleFiles(view, files);
					cleanupAll(view);
					return handled;
				},

				dragend(view: EditorView) {
					cleanupAll(view);
					return false;
				},

				paste(view: EditorView, event: ClipboardEvent) {
					const files = Array.from(event.clipboardData?.files ?? []);
					if (!files.length) return false;

					event.preventDefault();
					const handled = handleFiles(view, files);
					cleanupAll(view);
					return handled;
				}
			}
		},

		view() {
			return {
				destroy() {
					hideCaret(true);
				}
			};
		}
	});
}
