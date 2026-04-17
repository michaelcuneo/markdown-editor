// src/lib/editor/plugins/codemirrorBlockPlugin.ts
import { Plugin } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView as PMView, NodeView } from 'prosemirror-view';

import { EditorState as CMState, Compartment, type Extension } from '@codemirror/state';
import { EditorView as CMView, highlightSpecialChars, ViewUpdate } from '@codemirror/view';

import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { css } from '@codemirror/lang-css';

import { codeMirrorTheme } from '../theme/codeMirrorTheme';

const LANGUAGE_OPTIONS = [
	{ value: 'plaintext', label: 'Plain Text' },
	{ value: 'svelte', label: 'Svelte' },
	{ value: 'javascript', label: 'JavaScript' },
	{ value: 'typescript', label: 'TypeScript' },
	{ value: 'python', label: 'Python' },
	{ value: 'markdown', label: 'Markdown' },
	{ value: 'css', label: 'CSS' }
] as const;

const LANGUAGE_ALIASES: Record<string, string> = {
	js: 'javascript',
	javascript: 'javascript',
	ts: 'typescript',
	typescript: 'typescript',
	py: 'python',
	python: 'python',
	md: 'markdown',
	markdown: 'markdown',
	css: 'css',
	txt: 'plaintext',
	text: 'plaintext',
	svelte: 'svelte',
	plaintext: 'plaintext',
	plain: 'plaintext'
};

const languageMap: Record<string, () => Extension> = {
	javascript,
	typescript: javascript,
	svelte: () => javascript({ typescript: true }),
	python,
	markdown,
	css,
	plaintext: () => []
};

function normalizeLanguage(value: unknown): string {
	if (typeof value !== 'string') return 'plaintext';

	const trimmed = value.trim().toLowerCase();
	if (!trimmed) return 'plaintext';

	const firstToken = trimmed.split(/\s+/)[0] ?? 'plaintext';
	return LANGUAGE_ALIASES[firstToken] ?? 'plaintext';
}

function getLanguageFromParams(params: unknown): string {
	return normalizeLanguage(params);
}

function getLanguageExtension(lang: string): Extension {
	const factory = languageMap[lang] ?? (() => []);
	return factory();
}

function getLanguageLabel(lang: string): string {
	const option = LANGUAGE_OPTIONS.find((item) => item.value === lang);
	return option?.label ?? 'Plain Text';
}

class CodeMirrorBlockView implements NodeView {
	node: PMNode;
	view: PMView;
	getPos: () => number | undefined;

	dom: HTMLElement;
	label: HTMLButtonElement;
	menu: HTMLDivElement;
	cmHost: HTMLElement;
	cm: CMView;

	currentLang: string;
	editable: boolean;
	menuOpen = false;

	private syncingFromPM = false;
	private syncingFromCM = false;

	private languageCompartment = new Compartment();
	private editableCompartment = new Compartment();

	private onDocumentPointerDown = (event: PointerEvent): void => {
		const target = event.target as Node | null;
		if (!target) return;
		if (this.dom.contains(target)) return;
		this.closeMenu();
	};

	private onDocumentKeyDown = (event: KeyboardEvent): void => {
		if (event.key === 'Escape') {
			this.closeMenu();
			this.label.focus();
		}
	};

	constructor(node: PMNode, view: PMView, getPos: () => number | undefined) {
		this.node = node;
		this.view = view;
		this.getPos = getPos;

		this.currentLang = getLanguageFromParams(node.attrs.params);
		this.editable = this.isEditable();

		this.dom = document.createElement('div');
		this.dom.className = 'pm-codemirror-wrapper';

		this.label = document.createElement('button');
		this.label.type = 'button';
		this.label.className = 'pm-code-lang';
		this.label.setAttribute('aria-label', 'Code language');
		this.label.setAttribute('aria-haspopup', 'listbox');
		this.label.setAttribute('aria-expanded', 'false');
		this.label.textContent = getLanguageLabel(this.currentLang);
		this.label.disabled = !this.editable;
		this.label.addEventListener('click', this.handleLabelClick);
		this.label.addEventListener('keydown', this.handleLabelKeyDown);
		this.dom.appendChild(this.label);

		this.menu = document.createElement('div');
		this.menu.className = 'pm-code-lang-menu';
		this.menu.setAttribute('role', 'listbox');
		this.menu.hidden = true;
		this.dom.appendChild(this.menu);

		this.renderLanguageMenu();

		this.cmHost = document.createElement('div');
		this.cmHost.className = 'pm-codemirror-editor';
		this.dom.appendChild(this.cmHost);

		this.cm = this.createCodeMirror(node.textContent, this.currentLang, this.editable);

		document.addEventListener('pointerdown', this.onDocumentPointerDown);
		document.addEventListener('keydown', this.onDocumentKeyDown);
	}

	private isEditable(): boolean {
		try {
			return this.view.editable;
		} catch {
			return true;
		}
	}

	private createCodeMirror(doc: string, lang: string, editable: boolean): CMView {
		return new CMView({
			parent: this.cmHost,
			state: CMState.create({
				doc,
				extensions: [
					highlightSpecialChars(),
					...codeMirrorTheme,
					this.languageCompartment.of(getLanguageExtension(lang)),
					this.editableCompartment.of(CMView.editable.of(editable)),
					CMView.updateListener.of((update: ViewUpdate) => {
						this.onCodeMirrorUpdate(update);
					})
				]
			})
		});
	}

	private renderLanguageMenu(): void {
		this.menu.innerHTML = '';

		for (const option of LANGUAGE_OPTIONS) {
			const item = document.createElement('button');
			item.type = 'button';
			item.className = 'pm-code-lang-option';
			item.setAttribute('role', 'option');
			item.dataset.lang = option.value;
			item.textContent = option.label;

			if (option.value === this.currentLang) {
				item.setAttribute('aria-selected', 'true');
				item.dataset.active = 'true';
			}

			item.addEventListener('click', () => {
				this.applyLanguage(option.value);
				this.closeMenu();
				this.label.focus();
			});

			this.menu.appendChild(item);
		}
	}

	private handleLabelClick = (): void => {
		if (!this.editable) return;
		this.menuOpen ? this.closeMenu() : this.openMenu();
	};

	private handleLabelKeyDown = (event: KeyboardEvent): void => {
		if (!this.editable) return;

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			this.menuOpen ? this.closeMenu() : this.openMenu();
			return;
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			this.openMenu();
			const first = this.menu.querySelector<HTMLButtonElement>('.pm-code-lang-option');
			first?.focus();
		}
	};

	private openMenu(): void {
		if (this.menuOpen || !this.editable) return;
		this.menuOpen = true;
		this.menu.hidden = false;
		this.label.setAttribute('aria-expanded', 'true');
	}

	private closeMenu(): void {
		if (!this.menuOpen) return;
		this.menuOpen = false;
		this.menu.hidden = true;
		this.label.setAttribute('aria-expanded', 'false');
	}

	private applyLanguage(lang: string): void {
		if (!this.editable) return;

		const normalized = normalizeLanguage(lang);
		if (normalized === this.currentLang) return;

		const pos = this.safeGetPos();
		if (pos == null) return;

		const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
			...this.node.attrs,
			params: normalized
		});

		this.view.dispatch(tr);
	}

	private onCodeMirrorUpdate(update: ViewUpdate): void {
		if (!update.docChanged) return;
		if (!this.editable) return;
		if (this.syncingFromPM) return;

		const pos = this.safeGetPos();
		if (pos == null) return;

		const text = update.state.doc.toString();
		const { state } = this.view;
		const from = pos + 1;
		const to = pos + 1 + this.node.content.size;

		this.syncingFromCM = true;
		try {
			let tr = state.tr;

			if (text.length > 0) {
				tr = tr.replaceWith(from, to, state.schema.text(text));
			} else {
				tr = tr.delete(from, to);
			}

			if (tr.docChanged) {
				this.view.dispatch(tr);
			}
		} finally {
			this.syncingFromCM = false;
		}
	}

	private safeGetPos(): number | null {
		try {
			const pos = this.getPos();
			return typeof pos === 'number' ? pos : null;
		} catch {
			return null;
		}
	}

	private setLanguage(lang: string): void {
		if (lang === this.currentLang) return;

		this.currentLang = lang;
		this.label.textContent = getLanguageLabel(lang);
		this.renderLanguageMenu();

		this.cm.dispatch({
			effects: this.languageCompartment.reconfigure(getLanguageExtension(lang))
		});
	}

	private setEditable(editable: boolean): void {
		if (editable === this.editable) return;

		this.editable = editable;
		this.label.disabled = !editable;

		if (!editable) this.closeMenu();

		this.cm.dispatch({
			effects: this.editableCompartment.reconfigure(CMView.editable.of(editable))
		});
	}

	update(node: PMNode): boolean {
		if (node.type !== this.node.type) return false;

		const nextLang = getLanguageFromParams(node.attrs.params);
		const nextText = node.textContent;
		const nextEditable = this.isEditable();

		this.node = node;
		this.setLanguage(nextLang);
		this.setEditable(nextEditable);

		const currentText = this.cm.state.doc.toString();
		if (!this.syncingFromCM && nextText !== currentText) {
			this.syncingFromPM = true;
			try {
				this.cm.dispatch({
					changes: { from: 0, to: this.cm.state.doc.length, insert: nextText }
				});
			} finally {
				this.syncingFromPM = false;
			}
		}

		return true;
	}

	selectNode(): void {
		this.dom.classList.add('ProseMirror-selectednode');
	}

	deselectNode(): void {
		this.dom.classList.remove('ProseMirror-selectednode');
	}

	stopEvent(event: Event): boolean {
		const target = event.target as Node | null;
		return !!target && this.dom.contains(target);
	}

	ignoreMutation(): boolean {
		return true;
	}

	destroy(): void {
		document.removeEventListener('pointerdown', this.onDocumentPointerDown);
		document.removeEventListener('keydown', this.onDocumentKeyDown);
		this.cm.destroy();
	}
}

export function codeMirrorBlockPlugin() {
	return new Plugin({
		props: {
			nodeViews: {
				code_block(node, view, getPos) {
					if (typeof getPos !== 'function') {
						throw new Error('code_block node view requires getPos');
					}

					return new CodeMirrorBlockView(node, view, getPos);
				}
			}
		}
	});
}
