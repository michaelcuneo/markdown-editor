/**
 * ======================================================
 * 📘 Markdown Editor – Type Definitions
 * ======================================================
 */

/**
 * Represents an image embedded or referenced within markdown.
 */
export type MarkdownImage = {
	id: string;
	file: File;
	previewUrl?: string;
};

/**
 * Props accepted by the MarkdownEditor component.
 */
export type MarkdownEditorProps = {
	value?: string;
	imageQueue?: MarkdownImage[];
	allowHtml?: boolean;
	name?: string;
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
	| 'link'
	| 'h1'
	| 'h2'
	| 'codeblock'
	| 'hr'
	| 'undo'
	| 'redo'
	| 'import'
	| 'export'
	| 'toggleHtml';
