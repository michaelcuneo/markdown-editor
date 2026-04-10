// src/lib/editor/plugins/codeMirrorBlockPlugin.ts
import { Plugin } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView as PMView, NodeView } from 'prosemirror-view';

import { EditorState as CMState, Compartment, type Extension } from '@codemirror/state';
import {
	EditorView as CMView,
	highlightSpecialChars,
	ViewUpdate
} from '@codemirror/view';

import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { css } from '@codemirror/lang-css';

import { codeMirrorTheme } from '../theme/codeMirrorTheme';

const languageMap: Record<string, () => Extension> = {
	js: javascript,
	javascript,
	ts: javascript,
	typescript: javascript,
	py: python,
	python,
	md: markdown,
	markdown,
	css,
	txt: () => [],
	text: () => [],
	plaintext: () => [],
	plain: () => []
};

function getLanguageFromParams(params: unknown): string {
	if (typeof params !== 'string') return 'plaintext';

	const trimmed = params.trim();
	if (!trimmed) return 'plaintext';

	return trimmed.split(/\s+/)[0]?.toLowerCase() ?? 'plaintext';
}

function getLanguageExtension(lang: string): Extension {
	const factory = languageMap[lang] ?? (() => []);
	return factory();
}

function prettyLang(lang: string): string {
	const aliases: Record<string, string> = {
		js: 'JavaScript',
		javascript: 'JavaScript',
		ts: 'TypeScript',
		typescript: 'TypeScript',
		py: 'Python',
		python: 'Python',
		md: 'Markdown',
		markdown: 'Markdown',
		css: 'CSS',
		txt: 'Plain Text',
		text: 'Plain Text',
		plaintext: 'Plain Text',
		plain: 'Plain Text'
	};

	return aliases[lang] ?? lang.toUpperCase();
}

class CodeMirrorBlockView implements NodeView {
	node: PMNode;
	view: PMView;
	getPos: () => number | undefined;

	dom: HTMLElement;
	label: HTMLElement;
	cmHost: HTMLElement;
	cm: CMView;

	currentLang: string;
	editable: boolean;

	private syncingFromPM = false;
	private syncingFromCM = false;

	private languageCompartment = new Compartment();
	private editableCompartment = new Compartment();

	constructor(node: PMNode, view: PMView, getPos: () => number | undefined) {
		this.node = node;
		this.view = view;
		this.getPos = getPos;

		this.currentLang = getLanguageFromParams(node.attrs.params);
		this.editable = this.isEditable();

		this.dom = document.createElement('div');
		this.dom.className = 'pm-codemirror-wrapper';

		this.label = document.createElement('div');
		this.label.className = 'pm-code-lang';
		this.label.textContent = prettyLang(this.currentLang);
		this.dom.appendChild(this.label);

		this.cmHost = document.createElement('div');
		this.cmHost.className = 'pm-codemirror-editor';
		this.dom.appendChild(this.cmHost);

		this.cm = this.createCodeMirror(node.textContent, this.currentLang, this.editable);
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
		this.label.textContent = prettyLang(lang);
		this.cm.dispatch({
			effects: this.languageCompartment.reconfigure(getLanguageExtension(lang))
		});
	}

	private setEditable(editable: boolean): void {
		if (editable === this.editable) return;
		this.editable = editable;
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