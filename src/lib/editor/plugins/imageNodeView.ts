import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';

type PreviewRegistryWindow = Window & {
	__imagePreviewMap?: Record<string, string>;
	__imageFileMap?: Record<string, File>;
	__imageOptimizeSourceMap?: Record<string, string>;
	__imageSigningPromises?: Record<string, Promise<string | null>>;
};

type ImageNodeViewOptions = {
	showOptimizationControls?: boolean;
};

function getPreviewUrl(src: string): string {
	if (typeof window === 'undefined') return src;
	const w = window as PreviewRegistryWindow;
	const map = w.__imagePreviewMap;
	const existing = map?.[src];
	if (existing) return existing;

	const file = w.__imageFileMap?.[src];
	if (!file) return src;

	const previewUrl = URL.createObjectURL(file);
	if (!w.__imagePreviewMap) {
		w.__imagePreviewMap = {};
	}
	w.__imagePreviewMap[src] = previewUrl;
	return previewUrl;
}

function isLocalId(src: string): boolean {
	return /^\/?local-img-/.test(src);
}

function isRemoteUrl(src: string): boolean {
	if (/^https?:\/\//i.test(src)) return true;
	if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return true;
	if (/^\/\//.test(src)) return true;
	return false;
}

function looksLikeS3Key(src: string): boolean {
	if (!src) return false;
	if (isLocalId(src)) return false;
	if (isRemoteUrl(src)) return false;
	return true;
}

export class ImageNodeView implements NodeView {
	dom: HTMLElement;
	node: PMNode;
	view: EditorView;
	getPos: () => number | undefined;

	private wrapper: HTMLElement;
	private img: HTMLImageElement;
	private caption: HTMLInputElement;
	private toolbar: HTMLElement;
	private optimizeBadge!: HTMLElement;
	private dragHandle: HTMLElement;
	private replaceInput: HTMLInputElement;
	private optimizePanel: HTMLElement;
	private optimizeDebug!: HTMLElement;
	private optimizeQualityInput: HTMLInputElement;
	private optimizeWidthsInput: HTMLInputElement;
	private optimizeFormatInput: HTMLSelectElement;
	private resizeHandles: HTMLElement[] = [];

	// resize state
	private _resizing = false;
	private _resizeStartX = 0;
	private _resizeStartW = 0;
	private _resizeAspect = 1;
	private _onResizeMove: ((e: MouseEvent) => void) | null = null;
	private _onResizeUp: ((e: MouseEvent) => void) | null = null;

	private _destroying = false;
	private imageResolveRaf: number | null = null;
	private showOptimizationControls = true;

	constructor(
		node: PMNode,
		view: EditorView,
		getPos: () => number | undefined,
		options: ImageNodeViewOptions = {}
	) {
		this.node = node;
		this.view = view;
		this.getPos = getPos;
		this.showOptimizationControls = options.showOptimizationControls !== false;

		// ── outer wrapper ────────────────────────────────────────────────
		this.wrapper = document.createElement('span');
		this.wrapper.className = 'pm-image-wrapper';
		this.wrapper.contentEditable = 'false';

		// ── drag handle ──────────────────────────────────────────────────
		this.dragHandle = document.createElement('span');
		this.dragHandle.className = 'pm-image-drag-handle';
		this.dragHandle.title = 'Drag to reorder';
		this.dragHandle.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>';

		// ── image ────────────────────────────────────────────────────────
		this.img = document.createElement('img');
		this.img.className = 'pm-image';
		this.img.draggable = true;
		this.updateImgSrc(node.attrs.src ?? '', node.attrs.previewSrc ?? null);
		this.updateImgSrcSet(node.attrs.srcSet ?? null);
		this.img.alt = node.attrs.alt ?? '';
		this.img.title = node.attrs.title ?? '';

		// ── toolbar (replace + link-style edit) ──────────────────────────
		this.toolbar = document.createElement('span');
		this.toolbar.className = 'pm-image-toolbar';
		this.optimizeBadge = document.createElement('span');
		this.optimizeBadge.className = 'pm-image-opt-badge pm-opt-pending';
		this.optimizeBadge.title = 'Optimization source';

		const replaceBtn = document.createElement('button');
		replaceBtn.type = 'button';
		replaceBtn.className = 'pm-image-btn';
		replaceBtn.title = 'Replace image';
		replaceBtn.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';

		// Hidden file input for replace
		this.replaceInput = document.createElement('input');
		this.replaceInput.type = 'file';
		this.replaceInput.accept = 'image/*';
		this.replaceInput.style.display = 'none';
		this.replaceInput.addEventListener('change', this.handleReplaceFile);
		replaceBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.replaceInput.click();
		});

		const optimizeBtn = document.createElement('button');
		optimizeBtn.type = 'button';
		optimizeBtn.className = 'pm-image-btn';
		optimizeBtn.title = 'Optimize image';
		optimizeBtn.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>';
		optimizeBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.toggleOptimizePanel();
		});

		const removeBtn = document.createElement('button');
		removeBtn.type = 'button';
		removeBtn.className = 'pm-image-btn pm-image-btn-danger';
		removeBtn.title = 'Remove image';
		removeBtn.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
		removeBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.removeNode();
		});

		if (this.showOptimizationControls) {
			this.toolbar.appendChild(this.optimizeBadge);
			this.toolbar.appendChild(optimizeBtn);
		}
		this.toolbar.appendChild(replaceBtn);
		this.toolbar.appendChild(removeBtn);

		this.optimizePanel = document.createElement('div');
		this.optimizePanel.className = 'pm-image-opt-panel';
		this.optimizePanel.hidden = true;
		this.optimizePanel.addEventListener('click', (event) => {
			event.stopPropagation();
		});

		const qualityRow = document.createElement('label');
		qualityRow.className = 'pm-image-opt-row';
		qualityRow.textContent = 'Quality';
		this.optimizeQualityInput = document.createElement('input');
		this.optimizeQualityInput.type = 'number';
		this.optimizeQualityInput.min = '0';
		this.optimizeQualityInput.max = '1';
		this.optimizeQualityInput.step = '0.01';
		this.optimizeQualityInput.value = String(this.node.attrs.quality ?? 0.82);
		qualityRow.appendChild(this.optimizeQualityInput);

		const widthsRow = document.createElement('label');
		widthsRow.className = 'pm-image-opt-row';
		widthsRow.textContent = 'Widths';
		this.optimizeWidthsInput = document.createElement('input');
		this.optimizeWidthsInput.type = 'text';
		this.optimizeWidthsInput.value = '480,1024,1920';
		widthsRow.appendChild(this.optimizeWidthsInput);

		const formatRow = document.createElement('label');
		formatRow.className = 'pm-image-opt-row';
		formatRow.textContent = 'Primary format';
		this.optimizeFormatInput = document.createElement('select');
		for (const format of ['image/webp', 'image/jpeg', 'image/avif']) {
			const option = document.createElement('option');
			option.value = format;
			option.textContent = format;
			this.optimizeFormatInput.appendChild(option);
		}
		formatRow.appendChild(this.optimizeFormatInput);

		const actions = document.createElement('div');
		actions.className = 'pm-image-opt-actions';
		const applyBtn = document.createElement('button');
		applyBtn.type = 'button';
		applyBtn.className = 'pm-image-opt-apply';
		applyBtn.textContent = 'Apply';
		applyBtn.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.emitOptimizeRequest();
			this.optimizePanel.hidden = true;
		});
		actions.appendChild(applyBtn);

		this.optimizePanel.appendChild(qualityRow);
		this.optimizePanel.appendChild(widthsRow);
		this.optimizePanel.appendChild(formatRow);
		this.optimizeDebug = document.createElement('div');
		this.optimizeDebug.className = 'pm-image-opt-debug';
		this.optimizePanel.appendChild(this.optimizeDebug);
		this.optimizePanel.appendChild(actions);
		this.refreshOptimizeDebugLabel(node.attrs.src ?? '');

		// ── caption (alt text) ───────────────────────────────────────────
		this.caption = document.createElement('input');
		this.caption.type = 'text';
		this.caption.className = 'pm-image-caption';
		this.caption.placeholder = 'Add a caption…';
		this.caption.value = node.attrs.alt ?? '';
		this.caption.addEventListener('input', this.handleCaptionInput);
		this.caption.addEventListener('keydown', (e) => {
			// prevent ProseMirror from stealing keystrokes inside caption
			e.stopPropagation();
		});
		this.caption.addEventListener('mousedown', (e) => {
			e.stopPropagation();
		});

		// ── assemble ─────────────────────────────────────────────────────
		this.wrapper.appendChild(this.dragHandle);
		this.wrapper.appendChild(this.img);
		this.wrapper.appendChild(this.toolbar);
		if (this.showOptimizationControls) {
			this.wrapper.appendChild(this.optimizePanel);
		}
		this.wrapper.appendChild(this.caption);
		this.wrapper.appendChild(this.replaceInput);

		// ── resize handles ────────────────────────────────────────────────
		const corners: Array<'nw' | 'ne' | 'sw' | 'se'> = ['nw', 'ne', 'sw', 'se'];
		for (const corner of corners) {
			const handle = document.createElement('span');
			handle.className = `pm-image-resize-handle pm-image-resize-${corner}`;
			handle.addEventListener('mousedown', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.startResize(e, corner.includes('e'));
			});
			this.resizeHandles.push(handle);
			this.wrapper.appendChild(handle);
		}

		// Apply persisted dimensions
		if (node.attrs.width) this.img.style.width = `${node.attrs.width}px`;
		if (node.attrs.height) this.img.style.height = `${node.attrs.height}px`;

		// Make wrapper draggable for the existing imageDropPlugin to handle
		this.wrapper.draggable = true;
		this.wrapper.addEventListener('dragstart', this.handleDragStart);

		this.dom = this.wrapper;
	}

	// ── update ─────────────────────────────────────────────────────────────
	update(node: PMNode): boolean {
		if (node.type !== this.node.type) return false;
		this.node = node;

		const src = node.attrs.src ?? '';
		this.updateImgSrc(src, node.attrs.previewSrc ?? null);
		this.updateImgSrcSet(node.attrs.srcSet ?? null);
		this.refreshOptimizeDebugLabel(src);
		this.img.alt = node.attrs.alt ?? '';
		this.img.title = node.attrs.title ?? '';

		// Only update caption if it's not currently focused (avoid fighting user)
		if (document.activeElement !== this.caption) {
			this.caption.value = node.attrs.alt ?? '';
		}

		// Apply persisted dimensions
		this.img.style.width = node.attrs.width ? `${node.attrs.width}px` : '';
		this.img.style.height = node.attrs.height ? `${node.attrs.height}px` : '';
		this.optimizeQualityInput.value = String(node.attrs.quality ?? 0.82);

		return true;
	}

	private toggleOptimizePanel(): void {
		this.refreshOptimizeDebugLabel(this.node.attrs.src ?? '');
		const isHidden = this.optimizePanel.hasAttribute('hidden');
		if (isHidden) {
			this.optimizePanel.removeAttribute('hidden');
		} else {
			this.optimizePanel.setAttribute('hidden', '');
		}
	}

	private emitOptimizeRequest(): void {
		const src = this.node.attrs.src;
		if (typeof src !== 'string' || src.length === 0) return;

		const quality = Number(this.optimizeQualityInput.value);
		const widths = this.optimizeWidthsInput.value
			.split(',')
			.map((part) => Number(part.trim()))
			.filter((num) => Number.isFinite(num) && num > 0)
			.map((num) => Math.round(num));

		this.view.dom.dispatchEvent(
			new CustomEvent('pm-image-optimize-request', {
				bubbles: true,
				detail: {
					id: src,
					quality: Number.isFinite(quality) ? quality : 0.82,
					widths,
					primaryFormat: this.optimizeFormatInput.value || 'image/webp'
				}
			})
		);
	}

	private refreshOptimizeDebugLabel(src: string): void {
		if (!this.optimizeDebug) return;
		const map = (window as PreviewRegistryWindow).__imageOptimizeSourceMap;
		const source =
			map?.[src] ?? (typeof src === 'string' && /^https?:\/\//i.test(src) ? 'remote' : 'pending');
		this.optimizeDebug.textContent = `Debug source: ${source}`;
		this.optimizeDebug.className = `pm-image-opt-debug pm-opt-${source}`;
		if (this.optimizeBadge) {
			this.optimizeBadge.textContent = source;
			this.optimizeBadge.className = `pm-image-opt-badge pm-opt-${source}`;
		}
	}

	// ── helpers ────────────────────────────────────────────────────────────
	private startResize(e: MouseEvent, rightAnchor: boolean): void {
		this._resizing = true;
		this._resizeStartX = e.clientX;
		this._resizeStartW = this.img.getBoundingClientRect().width;
		this._resizeAspect =
			this.img.naturalWidth > 0 ? this.img.naturalHeight / this.img.naturalWidth : 1;

		this.wrapper.classList.add('pm-img-resizing');

		const onMove = (ev: MouseEvent): void => {
			if (!this._resizing) return;
			const dx = rightAnchor ? ev.clientX - this._resizeStartX : this._resizeStartX - ev.clientX;
			const newW = Math.max(40, Math.round(this._resizeStartW + dx));
			const newH = Math.round(newW * this._resizeAspect);
			this.img.style.width = `${newW}px`;
			this.img.style.height = `${newH}px`;
		};

		const onUp = (ev: MouseEvent): void => {
			this._resizing = false;
			this.wrapper.classList.remove('pm-img-resizing');
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			this._onResizeMove = null;
			this._onResizeUp = null;

			const dx = rightAnchor ? ev.clientX - this._resizeStartX : this._resizeStartX - ev.clientX;
			const finalW = Math.max(40, Math.round(this._resizeStartW + dx));
			const finalH = Math.round(finalW * this._resizeAspect);
			this.updateNodeAttrs({ width: finalW, height: finalH });
		};

		this._onResizeMove = onMove;
		this._onResizeUp = onUp;
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	private updateImgSrc(src: string, previewSrc: string | null): void {
		if (this.imageResolveRaf !== null) {
			cancelAnimationFrame(this.imageResolveRaf);
			this.imageResolveRaf = null;
		}

		if (previewSrc) {
			this.img.src = previewSrc;
			this.img.dataset.id = src;
			return;
		}

		if (isLocalId(src)) {
			const tryResolve = (remaining: number): void => {
				const url = getPreviewUrl(src);
				if (url !== src) {
					this.img.src = url;
					this.imageResolveRaf = null;
					return;
				}

				if (remaining <= 0 || this._destroying) {
					this.imageResolveRaf = null;
					return;
				}

				this.imageResolveRaf = requestAnimationFrame(() => {
					tryResolve(remaining - 1);
				});
			};

			this.img.removeAttribute('src');
			tryResolve(30);
		} else if (isRemoteUrl(src)) {
			this.img.src = src;
		} else if (looksLikeS3Key(src)) {
			const map = (window as PreviewRegistryWindow).__imagePreviewMap;
			const resolved = map?.[src];
			if (resolved) {
				this.img.src = resolved;
			} else {
				this.img.removeAttribute('src');
				void this.resolveSignedUrl(src);
			}
		} else {
			this.img.src = src;
		}
		this.img.dataset.id = src;
	}

	private async resolveSignedUrl(key: string): Promise<void> {
		const signed = await this.getSignedUrl(key);
		if (!signed || this._destroying) return;

		if (this.node.attrs.src === key) {
			this.img.src = signed;
		}
	}

	private async getSignedUrl(key: string): Promise<string | null> {
		if (typeof window === 'undefined' || this._destroying) return null;

		const w = window as PreviewRegistryWindow;
		if (!w.__imagePreviewMap) w.__imagePreviewMap = {};
		if (w.__imagePreviewMap[key]) {
			return w.__imagePreviewMap[key] as string;
		}

		if (!w.__imageSigningPromises) w.__imageSigningPromises = {};
		if (!w.__imageSigningPromises[key]) {
			w.__imageSigningPromises[key] = fetch(`/api/presign?key=${encodeURIComponent(key)}`)
				.then(async (res) => {
					if (!res.ok) return null;
					const body = (await res.json()) as { url?: string };
					return typeof body.url === 'string' ? body.url : null;
				})
				.catch(() => null);
		}

		const signed = await w.__imageSigningPromises[key];
		delete w.__imageSigningPromises[key];
		if (!signed || this._destroying) return null;

		w.__imagePreviewMap[key] = signed;
		return signed;
	}

	private updateImgSrcSet(srcSet: string | null): void {
		if (typeof srcSet === 'string' && srcSet.trim().length > 0) {
			const entries = srcSet
				.split(',')
				.map((entry) => entry.trim())
				.filter((entry) => entry.length > 0);

			const hasKeyEntry = entries.some((entry) => {
				const [resource] = entry.split(/\s+/, 1);
				return typeof resource === 'string' && looksLikeS3Key(resource);
			});

			if (hasKeyEntry) {
				void this.resolveAndSetSignedSrcSet(srcSet);
			} else {
				this.img.srcset = srcSet;
				this.img.sizes = '100vw';
			}
			return;
		}

		this.img.removeAttribute('srcset');
		this.img.removeAttribute('sizes');
	}

	private async resolveAndSetSignedSrcSet(srcSet: string): Promise<void> {
		const entries = srcSet
			.split(',')
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0);

		const resolvedEntries: string[] = [];
		for (const entry of entries) {
			const [resource, descriptor] = entry.split(/\s+/, 2);
			if (!resource) continue;

			if (looksLikeS3Key(resource)) {
				const signed = await this.getSignedUrl(resource);
				if (!signed) continue;
				resolvedEntries.push(descriptor ? `${signed} ${descriptor}` : signed);
				continue;
			}

			resolvedEntries.push(entry);
		}

		if (resolvedEntries.length === 0 || this._destroying) {
			this.img.removeAttribute('srcset');
			this.img.removeAttribute('sizes');
			return;
		}

		if (this.node.attrs.srcSet !== srcSet) return;
		this.img.srcset = resolvedEntries.join(', ');
		this.img.sizes = '100vw';
	}

	private updateNodeAttrs(nextAttrs: Record<string, unknown>, scrollIntoView = false): void {
		const pos = this.getPos();
		if (pos == null) return;

		const { state, dispatch } = this.view;
		let tr = state.tr.setNodeMarkup(pos, undefined, {
			...this.node.attrs,
			...nextAttrs
		});

		if (scrollIntoView) {
			tr = tr.scrollIntoView();
		}

		dispatch(tr);
	}

	private handleCaptionInput = (): void => {
		this.updateNodeAttrs({
			alt: this.caption.value
		});
	};

	private handleReplaceFile = (): void => {
		const file = this.replaceInput.files?.[0];
		if (!file) return;

		// Revoke old local preview if applicable
		const oldSrc = this.node.attrs.src ?? '';
		if (isLocalId(oldSrc)) {
			const map = (window as PreviewRegistryWindow).__imagePreviewMap;
			const oldUrl = map?.[oldSrc];
			if (oldUrl) URL.revokeObjectURL(oldUrl);
			if (map) delete map[oldSrc];
		}
		const sourceMap = (window as PreviewRegistryWindow).__imageOptimizeSourceMap;
		if (sourceMap && oldSrc) {
			delete sourceMap[oldSrc];
		}

		const randomId =
			typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: `${Date.now()}-${Math.random().toString(16).slice(2)}`;
		const newId = `local-img-${randomId}`;
		const previewUrl = URL.createObjectURL(file);

		// Register in preview map
		const map = (window as PreviewRegistryWindow).__imagePreviewMap ?? {};
		map[newId] = previewUrl;
		(window as PreviewRegistryWindow).__imagePreviewMap = map;
		const optimizeMap = (window as PreviewRegistryWindow).__imageOptimizeSourceMap ?? {};
		optimizeMap[newId] = 'pending';
		(window as PreviewRegistryWindow).__imageOptimizeSourceMap = optimizeMap;

		// Emit a custom event so MarkdownEditor can push into imageQueue
		this.view.dom.dispatchEvent(
			new CustomEvent('pm-image-replaced', {
				bubbles: true,
				detail: {
					oldId: oldSrc,
					newId,
					file,
					previewUrl
				}
			})
		);

		this.updateNodeAttrs(
			{
				src: newId,
				previewSrc: previewUrl,
				srcSet: null,
				quality: null,
				alt: this.caption.value || file.name.replace(/\.[^.]+$/, '')
			},
			true
		);
		this.replaceInput.value = '';
	};

	private removeNode = (): void => {
		const pos = this.getPos();
		if (pos == null) return;

		const { state, dispatch } = this.view;
		const tr = state.tr.delete(pos, pos + this.node.nodeSize);
		dispatch(tr.scrollIntoView());
	};

	private handleDragStart = (e: DragEvent): void => {
		if (!e.dataTransfer) return;
		e.dataTransfer.setData('text/plain', 'pm-image-drag');
		e.dataTransfer.effectAllowed = 'move';
		this.wrapper.classList.add('pm-img-dragging');
	};

	// ── PM interface ───────────────────────────────────────────────────────
	stopEvent(event: Event): boolean {
		// Let drag events and resize mousemove/up through
		if (event.type.startsWith('drag')) return false;
		if (this._resizing && (event.type === 'mousemove' || event.type === 'mouseup')) return false;
		// Capture all other events inside the wrapper so PM doesn't interfere
		return this.wrapper.contains(event.target as Node);
	}

	ignoreMutation(): boolean {
		return true;
	}

	selectNode(): void {
		this.wrapper.classList.add('pm-image-selected');
	}

	deselectNode(): void {
		this.wrapper.classList.remove('pm-image-selected');
		this.optimizePanel.setAttribute('hidden', '');
	}

	destroy(): void {
		this._destroying = true;
		if (this.imageResolveRaf !== null) {
			cancelAnimationFrame(this.imageResolveRaf);
			this.imageResolveRaf = null;
		}
		if (this._onResizeMove) window.removeEventListener('mousemove', this._onResizeMove);
		if (this._onResizeUp) window.removeEventListener('mouseup', this._onResizeUp);
		this.wrapper.removeEventListener('dragstart', this.handleDragStart);
		this.replaceInput.removeEventListener('change', this.handleReplaceFile);
		this.caption.removeEventListener('input', this.handleCaptionInput);
	}
}
