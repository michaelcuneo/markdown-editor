import { Plugin, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import {
	buildSrcSet,
	DEFAULT_SHARPLESS_QUALITY,
	DEFAULT_SHARPLESS_TARGETS,
	optimiseImageWithSharpless,
	pickPreviewVariant,
	type OptimizationSource,
	type SharplessVariant
} from '../utils/sharpless.js';
import type {
	ImageUploadPayload,
	MarkdownImageOptions,
	MarkdownImageVariant
} from '../../types/index.js';

type ImageQueueItem = {
	id: string;
	file?: File;
	originalFile?: File;
	previewUrl?: string;
	srcSet?: string;
	quality?: number;
	optimizationSource?: OptimizationSource;
	format?: string;
	variants?: Array<{
		label: string;
		format: string;
		width: number;
		height: number;
		size: number;
		url: string;
	}>;
};

type PreviewRegistryWindow = Window & {
	__imagePreviewMap?: Record<string, string>;
	__imageFileMap?: Record<string, File>;
	__imageOptimizeSourceMap?: Record<string, string>;
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

export function imageDropPlugin(
	imageQueue: Record<string, ImageQueueItem>,
	imageOptions: MarkdownImageOptions = {}
) {
	let caretEl: HTMLDivElement | null = null;
	let draggingImg: HTMLElement | null = null;
	let caretTimeout: number | null = null;
	const registeredPreviewIds = new Set<string>();
	const generatedObjectUrls = new Set<string>();
	const optimizationEnabled = imageOptions.enableOptimization === true;
	const optimizeOnDrop = imageOptions.optimizeOnDrop !== false;
	const storageMode = imageOptions.storage ?? 'auto';
	const uploader = imageOptions.upload;
	const preferredFormat = imageOptions.preferredFormat ?? 'image/webp';
	const configuredFormats = imageOptions.formats ?? ['image/webp', 'image/jpeg', 'image/avif'];
	const configuredTargets = imageOptions.targets ?? DEFAULT_SHARPLESS_TARGETS;
	const configuredQuality = imageOptions.quality ?? DEFAULT_SHARPLESS_QUALITY;

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
		generatedObjectUrls.add(previewUrl);
		imageQueue[id] = { id, file, originalFile: file, previewUrl };
		registeredPreviewIds.add(id);

		const registry = getPreviewRegistry();
		if (registry) {
			registry[id] = previewUrl;
		}

		const w = window as PreviewRegistryWindow;
		if (!w.__imageFileMap) {
			w.__imageFileMap = {};
		}
		w.__imageFileMap[id] = file;
		if (!w.__imageOptimizeSourceMap) {
			w.__imageOptimizeSourceMap = {};
		}
		w.__imageOptimizeSourceMap[id] = 'pending';

		return previewUrl;
	}

	function updateImageNodeAttrsById(
		view: EditorView,
		id: string,
		attrs: Record<string, unknown>
	): void {
		const imageNodeType = view.state.schema.nodes.image;
		if (!imageNodeType) return;

		const matches: Array<{ pos: number; existing: Record<string, unknown> }> = [];
		view.state.doc.descendants((node, pos) => {
			if (node.type !== imageNodeType) return;
			if (node.attrs.src !== id) return;
			matches.push({ pos, existing: node.attrs as Record<string, unknown> });
		});

		if (matches.length === 0) return;

		let tr = view.state.tr;
		for (const match of matches) {
			tr = tr.setNodeMarkup(match.pos, undefined, {
				...match.existing,
				...attrs
			});
		}

		tr.setMeta('addToHistory', false);
		view.dispatch(tr);
	}

	async function optimiseImageEntry(view: EditorView, id: string, file: File): Promise<void> {
		if (!optimizationEnabled) return;
		const sourceFile = imageQueue[id]?.originalFile ?? imageQueue[id]?.file ?? file;

		try {
			const variants = await optimiseImageWithSharpless(sourceFile, {
				targets: configuredTargets,
				quality: configuredQuality,
				formats: configuredFormats
			});

			const resolved: Array<SharplessVariant & { url: string }> = variants.map((variant) => {
				const url = URL.createObjectURL(variant.blob);
				generatedObjectUrls.add(url);
				return {
					...variant,
					url
				};
			});

			const previewVariant = pickPreviewVariant(resolved, preferredFormat);
			const srcSet = buildSrcSet(resolved, preferredFormat);
			const previewUrl = previewVariant?.url;
			const optimizationSource =
				(variants[0]?.source as OptimizationSource | undefined) ?? 'original-fallback';

			if (!imageQueue[id]) {
				imageQueue[id] = { id, file: sourceFile, originalFile: sourceFile };
			}

			imageQueue[id] = {
				...imageQueue[id],
				id,
				file: sourceFile,
				originalFile: sourceFile,
				previewUrl: previewUrl ?? imageQueue[id]?.previewUrl,
				srcSet: srcSet || imageQueue[id]?.srcSet,
				quality: configuredQuality,
				optimizationSource,
				format: previewVariant?.format,
				variants: resolved.map((variant) => ({
					label: variant.label,
					format: variant.format,
					width: variant.width,
					height: variant.height,
					size: variant.size,
					url: variant.url
				}))
			};

			const registry = getPreviewRegistry();
			if (registry && previewUrl) {
				registry[id] = previewUrl;
			}
			const w = window as PreviewRegistryWindow;
			if (!w.__imageOptimizeSourceMap) {
				w.__imageOptimizeSourceMap = {};
			}
			w.__imageOptimizeSourceMap[id] = optimizationSource;

			updateImageNodeAttrsById(view, id, {
				previewSrc: previewUrl ?? null,
				srcSet: srcSet || null,
				quality: configuredQuality
			});

			const shouldAttemptUpload = storageMode !== 'local' && typeof uploader === 'function';

			if (shouldAttemptUpload) {
				const uploadVariants: MarkdownImageVariant[] = resolved.map((variant) => ({
					label: variant.label,
					format: variant.format,
					width: variant.width,
					height: variant.height,
					size: variant.size,
					url: variant.url,
					blob: variant.blob
				}));

				const uploadPayload: ImageUploadPayload = {
					id,
					file: sourceFile,
					queueItem: imageQueue[id],
					variants: uploadVariants
				};

				try {
					const uploadResult = await uploader(uploadPayload);
					if (uploadResult) {
						const nextSrc = uploadResult.src ?? id;
						const nextPreview = uploadResult.previewUrl ?? previewUrl ?? imageQueue[id]?.previewUrl;
						const nextSrcSet = uploadResult.srcSet ?? srcSet ?? imageQueue[id]?.srcSet;

						const uploadedEntry = {
							...imageQueue[id],
							id: nextSrc,
							previewUrl: nextPreview,
							srcSet: nextSrcSet
						};

						imageQueue[id] = uploadedEntry;
						if (nextSrc !== id) {
							imageQueue[nextSrc] = uploadedEntry;
						}

						const registry = getPreviewRegistry();
						if (registry && nextPreview) {
							registry[nextSrc] = nextPreview;
						}
						const w = window as PreviewRegistryWindow;
						if (!w.__imageOptimizeSourceMap) {
							w.__imageOptimizeSourceMap = {};
						}
						w.__imageOptimizeSourceMap[nextSrc] = optimizationSource;

						updateImageNodeAttrsById(view, id, {
							src: nextSrc,
							previewSrc: nextPreview ?? null,
							srcSet: nextSrcSet ?? null,
							quality: configuredQuality
						});
					}
				} catch {
					// upload failures fall back to local optimized variants
				}
			}
		} catch {
			// keep original preview on failure
		}
	}

	function revokePreview(id: string): void {
		const registry = getPreviewRegistry();
		if (!registry) return;

		const url = registry[id];
		if (!url) return;

		URL.revokeObjectURL(url);
		delete registry[id];

		const w = window as PreviewRegistryWindow;
		if (w.__imageFileMap) {
			delete w.__imageFileMap[id];
		}
	}

	function insertImagesAtSelection(
		view: EditorView,
		items: Array<{ id: string; alt: string; previewSrc: string }>
	): boolean {
		const imageNodeType = view.state.schema.nodes.image;
		if (!imageNodeType) {
			console.error('Image node is not defined in the schema.');
			return false;
		}

		const nodes = items.map(({ id, alt, previewSrc }) =>
			imageNodeType.create({ src: id, alt, previewSrc })
		);
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

		const items: Array<{ id: string; alt: string; previewSrc: string }> = [];
		const droppedEntries: Array<{ id: string; file: File }> = [];

		for (const file of imageFiles) {
			const id = createImageId();
			const alt = fileNameToAlt(file.name);
			const previewSrc = registerPreview(id, file);
			items.push({ id, alt, previewSrc });
			droppedEntries.push({ id, file });
		}

		const inserted = insertImagesAtSelection(view, items);
		if (!inserted) return false;

		for (const entry of droppedEntries) {
			if (optimizationEnabled && optimizeOnDrop) {
				void optimiseImageEntry(view, entry.id, entry.file);
			}
		}

		return true;
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
			(draggingImg.closest('.pm-image-wrapper') ?? draggingImg).classList.remove('pm-img-dragging');
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

					// Support both NodeView wrapper and bare img (legacy)
					const wrapper = target.closest('.pm-image-wrapper');
					const img = wrapper
						? wrapper.querySelector('img.pm-image')
						: target.closest('img.pm-image');
					if (!(img instanceof HTMLElement)) return false;

					draggingImg = img;
					(wrapper ?? img).classList.add('pm-img-dragging');

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
						// Use wrapper as posAtDOM target when NodeView is active
						const domTarget = draggingImg.closest('.pm-image-wrapper') ?? draggingImg;
						const domPos = view.posAtDOM(domTarget, 0);
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

					for (const url of generatedObjectUrls) {
						URL.revokeObjectURL(url);
					}

					registeredPreviewIds.clear();
					generatedObjectUrls.clear();
				}
			};
		}
	});
}
