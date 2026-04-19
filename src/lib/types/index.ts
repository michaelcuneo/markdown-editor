/**
 * ======================================================
 * 📘 Markdown Editor – Type Definitions
 * ======================================================
 */

/**
 * Represents an image embedded or referenced within markdown.
 */
export type MarkdownImageVariant = {
	label: string;
	format: string;
	width: number;
	height: number;
	size: number;
	url?: string;
	blob?: Blob;
};

export type MarkdownImage = {
	id: string;
	file?: File;
	originalFile?: File;
	name?: string;
	type?: string;
	size?: number;
	previewUrl?: string;
	srcSet?: string;
	quality?: number;
	optimizationSource?: 'sharpless' | 'canvas-fallback' | 'original-fallback' | 'pending';
	format?: string;
	variants?: MarkdownImageVariant[];
};

export type ImageOptimisationTarget = {
	width: number;
	label: string;
};

export type ImageUploadPayload = {
	id: string;
	file: File;
	queueItem: MarkdownImage;
	variants?: MarkdownImageVariant[];
};

export type ImageUploadResult = {
	src?: string;
	srcSet?: string;
	previewUrl?: string;
};

export type MarkdownImageOptions = {
	enableOptimization?: boolean;
	optimizeOnDrop?: boolean;
	storage?: 'auto' | 'local' | 'upload';
	quality?: number;
	formats?: string[];
	targets?: ImageOptimisationTarget[];
	preferredFormat?: string;
	upload?: (
		payload: ImageUploadPayload
	) => Promise<ImageUploadResult | void> | ImageUploadResult | void;
};

/**
 * Props accepted by the MarkdownEditor component.
 */
export type MarkdownEditorProps = {
	value?: string;
	imageQueue?: Record<string, MarkdownImage>;
	allowHtml?: boolean;
	name?: string;
	viewMode?: 'wysiwyg' | 'markdown';
	imageOptions?: MarkdownImageOptions;
};

/**
 * All toolbar action identifiers available in the editor.
 * These are emitted via the `onAction` handler in the toolbar.
 */
export type ToolbarAction =
	| 'bold'
	| 'italic'
	| 'strike'
	| 'quote'
	| 'ul'
	| 'ol'
	| 'task'
	| 'table'
	| 'tableAddRow'
	| 'tableAddColumn'
	| 'tableDeleteRow'
	| 'tableDeleteColumn'
	| 'tableDelete'
	| 'link'
	| 'h1'
	| 'h2'
	| 'codeblock'
	| 'hr'
	| 'alignLeft'
	| 'alignCenter'
	| 'alignRight'
	| 'undo'
	| 'redo'
	| 'import'
	| 'export';
