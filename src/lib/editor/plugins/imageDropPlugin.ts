import { Plugin, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

type ImageQueueItem = {
	id: string;
	file: File;
	previewUrl?: string;
};

type PreviewRegistryWindow = Window & {
	__imagePreviewMap?: Record<string, string>;
};

function getPreviewRegistry(): Record<string, string> | null {
	if (typeof window === 'undefined') return null;

	const w = window as PreviewRegistryWindow;
	if (!w.__imagePreviewMap) {
		w.__imagePreviewMap = {};
	}

	return w.__imagePreviewMap;
}

function createImageId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `local-img-${crypto.randomUUID()}`;
	}

	return `local-img-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function fileNameToAlt(fileName: string): string {
	return fileName.replace(/\.[^.]+$/, '');
}

export function imageDropPlugin(imageQueue: ImageQueueItem[]) {
	let caretEl: HTMLDivElement | null = null;
	let draggingImg: HTMLElement | null = null;
	let caretTimeout: number | null = null;
	const registeredPreviewIds = new Set<string>();

	function clearCaretTimer(): void {
		if (caretTimeout !== null) {
			window.clearTimeout(caretTimeout);
			caretTimeout = null;
		}
	}

	function ensureCaret(): HTMLDivElement {
		if (!caretEl) {
			caretEl = document.createElement('div');
			caretEl.className = 'pm-drop-caret';
			document.body.appendChild(caretEl);
		}

		return caretEl;
	}

	function registerPreview(id: string, file: File): string {
		const previewUrl = URL.createObjectURL(file);
		imageQueue.push({ id, file, previewUrl });
		registeredPreviewIds.add(id);

		const registry = getPreviewRegistry();
		if (registry) {
			registry[id] = previewUrl;
		}

		return previewUrl;
	}

	function revokePreview(id: string): void {
		const registry = getPreviewRegistry();
		if (!registry) return;

		const url = registry[id];
		if (!url) return;

		URL.revokeObjectURL(url);
		delete registry[id];
	}

	function insertImagesAtSelection(
		view: EditorView,
		items: Array<{ id: string; alt: string }>
	): boolean {
		const imageNodeType = view.state.schema.nodes.image;
		if (!imageNodeType) {
			console.error('Image node is not defined in the schema.');
			return false;
		}

		const nodes = items.map(({ id, alt }) => imageNodeType.create({ src: id, alt }));
		if (nodes.length === 0) return false;

		let tr = view.state.tr;
		let insertPos = tr.selection.from;

		for (const node of nodes) {
			tr = tr.insert(insertPos, node);
			insertPos += node.nodeSize;
		}

		tr = tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos))).scrollIntoView();
		view.dispatch(tr);
		return true;
	}

	function handleFiles(view: EditorView, files: File[]): boolean {
		const imageFiles = files.filter((file) => file.type.startsWith('image/'));
		if (imageFiles.length === 0) return false;

		const items: Array<{ id: string; alt: string }> = [];

		for (const file of imageFiles) {
			const id = createImageId();
			const alt = fileNameToAlt(file.name);
			registerPreview(id, file);
			items.push({ id, alt });
		}

		return insertImagesAtSelection(view, items);
	}

	function showCaret(view: EditorView, x: number, y: number): void {
		const pos = view.posAtCoords({ left: x, top: y });
		if (!pos) return;

		const rect = view.coordsAtPos(pos.pos);
		const caret = ensureCaret();

		caret.style.left = `${rect.left}px`;
		caret.style.top = `${rect.top}px`;
		caret.style.height = `${rect.bottom - rect.top}px`;
		caret.style.opacity = '1';

		clearCaretTimer();
		caretTimeout = window.setTimeout(() => {
			hideCaret(false);
		}, 1200);
	}

	function hideCaret(force = false): void {
		clearCaretTimer();

		if (!caretEl) return;

		caretEl.style.opacity = '0';

		if (force) {
			caretEl.remove();
			caretEl = null;
		}
	}

	function moveImageNode(view: EditorView, fromPos: number, toPos: number): boolean {
		const { state, dispatch } = view;
		const node = state.doc.nodeAt(fromPos);

		if (!node || node.type !== state.schema.nodes.image) {
			return false;
		}

		const tr = state.tr.delete(fromPos, fromPos + node.nodeSize);
		const insertPos = toPos > fromPos ? toPos - node.nodeSize : toPos;

		tr.insert(insertPos, node);
		dispatch(tr.scrollIntoView());
		return true;
	}

	function cleanupDragState(view?: EditorView): void {
		hideCaret(true);

		if (view) {
			view.dom.classList.remove('pm-dragging-image');
		}

		if (draggingImg) {
			draggingImg.classList.remove('pm-img-dragging');
			draggingImg = null;
		}
	}

	function isExternalDragLeave(view: EditorView, event: DragEvent): boolean {
		const related = event.relatedTarget;
		if (!(related instanceof Node)) return true;
		return !view.dom.contains(related);
	}

	function eventHasImageData(event: DragEvent): boolean {
		if (draggingImg) return true;

		const items = Array.from(event.dataTransfer?.items ?? []);
		return items.some((item) => item.type.startsWith('image/'));
	}

	return new Plugin({
		props: {
			handleDOMEvents: {
				dragstart(_view: EditorView, event: DragEvent) {
					const target = event.target;
					if (!(target instanceof HTMLElement)) return false;

					const img = target.closest('img.pm-image');
					if (!(img instanceof HTMLElement)) return false;

					draggingImg = img;
					draggingImg.classList.add('pm-img-dragging');

					if (event.dataTransfer) {
						event.dataTransfer.setData('text/plain', 'pm-image-drag');
						event.dataTransfer.effectAllowed = 'move';
					}

					return true;
				},

				dragenter(view: EditorView, event: DragEvent) {
					if (!eventHasImageData(event)) return false;

					view.dom.classList.add('pm-dragging-image');
					return true;
				},

				dragover(view: EditorView, event: DragEvent) {
					if (!eventHasImageData(event)) return false;

					event.preventDefault();
					showCaret(view, event.clientX, event.clientY);
					view.dom.classList.add('pm-dragging-image');
					return true;
				},

				dragleave(view: EditorView, event: DragEvent) {
					if (!isExternalDragLeave(view, event)) {
						return false;
					}

					cleanupDragState(view);
					return false;
				},

				drop(view: EditorView, event: DragEvent) {
					event.preventDefault();

					const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
					if (!pos) {
						cleanupDragState(view);
						return false;
					}

					if (draggingImg) {
						const domPos = view.posAtDOM(draggingImg, 0);
						const moved = domPos != null && moveImageNode(view, domPos, pos.pos);
						cleanupDragState(view);
						return moved;
					}

					const files = Array.from(event.dataTransfer?.files ?? []);
					if (files.length === 0) {
						cleanupDragState(view);
						return false;
					}

					const tr = view.state.tr.setSelection(
						TextSelection.near(view.state.doc.resolve(pos.pos))
					);
					view.dispatch(tr);

					const handled = handleFiles(view, files);
					cleanupDragState(view);
					return handled;
				},

				dragend(view: EditorView) {
					cleanupDragState(view);
					return false;
				},

				paste(view: EditorView, event: ClipboardEvent) {
					const files = Array.from(event.clipboardData?.files ?? []);
					if (files.length === 0) return false;

					const hasImage = files.some((file) => file.type.startsWith('image/'));
					if (!hasImage) return false;

					event.preventDefault();
					const handled = handleFiles(view, files);
					cleanupDragState(view);
					return handled;
				}
			}
		},

		view(view: EditorView) {
			return {
				destroy() {
					cleanupDragState(view);

					for (const id of registeredPreviewIds) {
						revokePreview(id);
					}

					registeredPreviewIds.clear();
				}
			};
		}
	});
}