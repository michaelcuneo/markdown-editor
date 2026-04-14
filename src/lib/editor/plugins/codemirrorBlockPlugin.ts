import { Plugin } from 'prosemirror-state';
import type { NodeView } from 'prosemirror-view';
import { EditorState as CMState } from '@codemirror/state';
import { EditorView as CMView, highlightSpecialChars, ViewUpdate } from '@codemirror/view';
import { codeMirrorTheme } from '../theme/codeMirrorTheme';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { css } from '@codemirror/lang-css';
import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView as PMView } from 'prosemirror-view';
import type { Extension } from '@codemirror/state';

const languageMap: Record<string, () => Extension> = {
	js: javascript,
	javascript,
	ts: javascript,
	typescript: javascript,
	sveltekit: javascript,
	svelte: javascript,
	py: python,
	python,
	md: markdown,
	markdown,
	css,
	txt: () => []
};

class CodeMirrorBlockView implements NodeView {
	node: PMNode;
	view: PMView;
	getPos: () => number;
	cm: CMView;
	dom: HTMLElement;
	label: HTMLElement;
	currentLang: string;
	editable: boolean;

	constructor(node: PMNode, view: PMView, getPos: () => number) {
		this.node = node;
		this.view = view;
		this.getPos = getPos;
		this.currentLang = node.attrs.params || 'plaintext';
		this.editable = view.editable ? view.editable : true;

		this.dom = document.createElement('div');
		this.dom.className = 'pm-codemirror-wrapper';

		this.label = document.createElement('div');
		this.label.className = 'pm-code-lang';
		this.label.textContent = this.prettyLang(this.currentLang);
		this.dom.appendChild(this.label);

		this.cm = this.createCodeMirror(node.textContent, this.currentLang, this.editable);
	}

	createCodeMirror(doc: string, lang: string, editable = true) {
		const languageExtension = this.getLanguageExtension(lang);

		return new CMView({
			state: CMState.create({
				doc,
				extensions: [
					highlightSpecialChars(),
					...codeMirrorTheme, // 👈 drop in our theme
					languageExtension,
					editable ? [] : CMView.editable.of(false),
					CMView.updateListener.of((update: ViewUpdate) => {
						if (update.docChanged && editable) {
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

		if (newLang !== this.currentLang) {
			this.currentLang = newLang;
			this.label.textContent = this.prettyLang(newLang);
			this.rebuildCodeMirror(newText, newLang);
			return true;
		}

		if (newText !== this.cm.state.doc.toString()) {
			this.cm.dispatch({
				changes: { from: 0, to: this.cm.state.doc.length, insert: newText }
			});
		}

		this.node = node;
		return true;
	}

	rebuildCodeMirror(newText: string, newLang: string) {
		this.cm.destroy();
		this.cm = this.createCodeMirror(newText, newLang, this.editable);
	}

	setEditable(editable: boolean) {
		this.editable = editable;
		this.rebuildCodeMirror(this.node.textContent, this.currentLang);
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
					const cmView = new CodeMirrorBlockView(node, view, getPos as () => number);

					// 🔒 Listen for changes in editable state
					const origSetProps = view.setProps.bind(view);
					view.setProps = (props) => {
						if (typeof props.editable === 'function') {
							const editable = props.editable(view.state);
							cmView.setEditable(editable);
						}
						origSetProps(props);
					};

					return cmView;
				}
			}
		}
	});
}
