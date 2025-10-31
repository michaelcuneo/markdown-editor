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
	| 'undo'
	| 'redo'
	| 'import'
	| 'export'
	| 'toggleHtml';

/**
 * Props accepted by the EditorToolbar component.
 */
export type EditorToolbarProps = {
	allowHtml: boolean;
	onAction: (action: ToolbarAction) => void;
};

/**
 * ======================================================
 * 📂 FileDialog Types
 * ======================================================
 */

/**
 * The type of dialog to display: importing a markdown file or exporting content.
 */
export type FileDialogType = 'import' | 'export';

/**
 * Detail payload for a FileDialog confirm event.
 */
export type FileDialogConfirmDetail =
	| { file: File } // import
	| { format: 'md' | 'html' }; // export

/**
 * Props for the FileDialog component.
 */
export type FileDialogProps = {
	type: FileDialogType;
	onclose: () => void;
	onconfirm: (e: CustomEvent<FileDialogConfirmDetail>) => void;
};

/**
 * ======================================================
 * 🪶 MarkdownPreview Types
 * ======================================================
 */

/**
 * Props for the MarkdownPreview component.
 */
export type MarkdownPreviewProps = {
	value: string;
	imageQueue: MarkdownImage[];
	allowHtml: boolean;
};
