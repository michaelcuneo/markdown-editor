// ======================================================
// 📦 Markdown Editor – Public Entry Point
// ======================================================
import './styles/global.css';

export { default as MarkdownEditor } from './editor/MarkdownEditor.svelte';
export type {
	MarkdownImage,
	MarkdownImageVariant,
	MarkdownEditorProps,
	MarkdownImageOptions,
	ImageOptimisationTarget,
	ImageUploadPayload,
	ImageUploadResult
} from './types/index.js';
