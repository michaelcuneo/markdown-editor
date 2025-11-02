// src/lib/editor/plugins/codeMirrorBlockPlugin.ts
import { Plugin } from 'prosemirror-state';
import type { NodeView } from 'prosemirror-view';
import { EditorState as CMState } from '@codemirror/state';
import type { EditorView } from 'prosemirror-view';
import { EditorView as CMView, keymap, highlightSpecialChars } from '@codemirror/view';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { css } from '@codemirror/lang-css';
import type { Node as PMNode } from 'prosemirror-model';

const languageMap: Record<string, () => ReturnType<typeof javascript>> = {
	js: javascript,
	javascript,
	ts: javascript,
	typescript: javascript,
	py: python,
	python,
	md: markdown,
	markdown,
	css,
	txt: () => null as unknown as ReturnType<typeof javascript>
};

/**
 * NodeView for CodeMirror code_block nodes.
 * Features:
 * - Real-time syntax highlighting via CodeMirror
 * - Auto language switching when ```lang changes
 * - Floating language label overlay
 */
class CodeMirrorBlockView implements NodeView {
	node: PMNode;
	view: EditorView;
	getPos: () => number;
	cm: CMView;
	dom: HTMLElement;
	label: HTMLElement;
	currentLang: string;

	constructor(node: PMNode, view: EditorView, getPos: () => number) {
		this.node = node;
		this.view = view;
		this.getPos = getPos;
		this.currentLang = node.attrs.params || 'plaintext';

		// Outer wrapper (holds label + editor)
		this.dom = document.createElement('div');
		this.dom.className = 'pm-codemirror-wrapper';

		// --- Language label
		this.label = document.createElement('div');
		this.label.className = 'pm-code-lang';
		this.label.textContent = this.prettyLang(this.currentLang);
		this.dom.appendChild(this.label);

		// --- CodeMirror editor
		this.cm = this.createCodeMirror(node.textContent, this.currentLang);
	}

	createCodeMirror(doc: string, lang: string) {
		const languageExtension = this.getLanguageExtension(lang);

		return new CMView({
			state: CMState.create({
				doc,
				extensions: [
					highlightSpecialChars(),
					syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
					keymap.of([]),
					oneDark,
					languageExtension,
					CMView.updateListener.of((update) => {
						if (update.docChanged) {
							const text = update.state.doc.toString();
							const tr = this.view.state.tr.replaceWith(
								this.getPos() + 1,
								this.getPos() + 1 + this.node.content.size,
								this.view.state.schema.text(text)
							);
							this.view.dispatch(tr);
						}
					})
				]
			}),
			parent: this.dom
		});
	}

	getLanguageExtension(lang: string) {
		const normal = lang.toLowerCase();
		const factory = languageMap[normal] || (() => []);
		return factory();
	}

	prettyLang(lang: string) {
		if (!lang || lang === 'plaintext') return 'Plain Text';
		const normalized = lang.toLowerCase();
		const aliases: Record<string, string> = {
			js: 'JavaScript',
			ts: 'TypeScript',
			py: 'Python',
			md: 'Markdown',
			json: 'JSON',
			css: 'CSS'
		};
		return aliases[normalized] || lang.toUpperCase();
	}

	update(node: PMNode) {
		if (node.type !== this.node.type) return false;

		const newLang = node.attrs.params || 'plaintext';
		const newText = node.textContent;

		// 🧠 Detect language change
		if (newLang !== this.currentLang) {
			this.currentLang = newLang;
			this.label.textContent = this.prettyLang(newLang);

			const newState = CMState.create({
				doc: newText,
				extensions: [
					highlightSpecialChars(),
					syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
					keymap.of([]),
					oneDark,
					this.getLanguageExtension(newLang),
					CMView.updateListener.of((update) => {
						if (update.docChanged) {
							const text = update.state.doc.toString();
							const tr = this.view.state.tr.replaceWith(
								this.getPos() + 1,
								this.getPos() + 1 + this.node.content.size,
								this.view.state.schema.text(text)
							);
							this.view.dispatch(tr);
						}
					})
				]
			});
			this.cm.setState(newState);
			return true;
		}

		// 🧩 Sync text
		if (newText !== this.cm.state.doc.toString()) {
			this.cm.dispatch({
				changes: { from: 0, to: this.cm.state.doc.length, insert: newText }
			});
		}

		this.node = node;
		return true;
	}

	stopEvent() {
		return true;
	}

	destroy() {
		this.cm.destroy();
	}
}

export function codeMirrorBlockPlugin() {
	return new Plugin({
		props: {
			nodeViews: {
				code_block(node, view, getPos) {
					if (!getPos) throw new Error('getPos is undefined');
					return new CodeMirrorBlockView(node, view, getPos as () => number);
				}
			}
		}
	});
}
