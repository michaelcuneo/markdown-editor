// src/lib/editor/plugins/wysiwymPlugin.ts
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { EditorState, Transaction, PluginSpec } from 'prosemirror-state';
import type { Schema, MarkType, Mark } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';

type MarkAttrs = Record<string, string | number | boolean | null>;

function normalizeHref(href: string): string {
	const trimmed = href.trim();
	if (!trimmed) return '';

	if (/^(https?|ftp):\/\//i.test(trimmed)) return trimmed;
	if (/^(mailto:|tel:)/i.test(trimmed)) return trimmed;

	return `https://${trimmed}`;
}

function promptUrl(initial = ''): string {
	if (typeof window === 'undefined') return '';
	return normalizeHref(window.prompt('Enter URL:', initial) ?? '');
}

function isSingleCharTextInsertion(tr: Transaction): boolean {
	if (!tr.docChanged || !tr.selectionSet) return false;

	for (const step of tr.steps) {
		const json = step.toJSON() as {
			stepType?: string;
			slice?: {
				content?: Array<{
					type?: string;
					text?: string;
				}>;
			};
		};

		if (json.stepType !== 'replace' && json.stepType !== 'replaceAround') {
			continue;
		}

		const content = json.slice?.content;
		if (!content || content.length !== 1) continue;

		const first = content[0];
		if (!first || first.type !== 'text') continue;
		if ((first.text ?? '').length !== 1) continue;

		return true;
	}

	return false;
}

function wordRangeAtCursor(state: EditorState): { from: number; to: number } | null {
	const { $from } = state.selection;
	const parent = $from.parent;

	if (!parent.isTextblock) return null;

	const text = parent.textContent;
	const offset = $from.parentOffset;

	const leftText = text.slice(0, offset);
	const rightText = text.slice(offset);

	const leftMatch = leftText.match(/[^\s()[\]{}<>"]+$/);
	const rightMatch = rightText.match(/^[^\s()[\]{}<>"]+/);

	const left = leftMatch ? offset - leftMatch[0].length : offset;
	const right = rightMatch ? offset + rightMatch[0].length : offset;

	if (left === right) return null;

	return {
		from: $from.start() + left,
		to: $from.start() + right
	};
}

function getMarkHref(mark: Mark | undefined): string | undefined {
	const href = mark?.attrs?.href;
	return typeof href === 'string' ? href : undefined;
}

function findExistingLinkHref(
	state: EditorState,
	from: number,
	to: number,
	link: MarkType
): string | undefined {
	const $from = state.doc.resolve(from);
	const $to = state.doc.resolve(Math.max(from, to));

	const direct = $from.marks().find((mark) => mark.type === link);
	const directHref = getMarkHref(direct);
	if (directHref) return directHref;

	let href: string | undefined;

	state.doc.nodesBetween(from, $to.pos, (node) => {
		if (!node.isText) return;

		const mark = node.marks.find((m) => m.type === link);
		const foundHref = getMarkHref(mark);
		if (foundHref) {
			href = foundHref;
			return false;
		}

		return;
	});

	return href;
}

function replaceWrappedTextWithMark(
	tr: Transaction,
	fullFrom: number,
	fullTo: number,
	innerText: string,
	markType: MarkType,
	attrs?: MarkAttrs
): Transaction {
	tr.delete(fullFrom, fullTo);
	tr.insertText(innerText, fullFrom);
	tr.addMark(fullFrom, fullFrom + innerText.length, markType.create(attrs));
	return tr;
}

function selectionAt(tr: Transaction, pos: number): TextSelection {
	const safePos = Math.max(0, Math.min(pos, tr.doc.content.size));
	return TextSelection.create(tr.doc, safePos);
}

export function wysiwymPlugin(schema: Schema): Plugin {
	const key = new PluginKey('wysiwymMarkdown');

	const strong = schema.marks.strong;
	const em = schema.marks.em;
	const code = schema.marks.code;
	const link = schema.marks.link;

	const spec: PluginSpec<null> = {
		key,

		props: {
			handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
				const isMod = event.metaKey || event.ctrlKey;
				if (!isMod) return false;
				if (event.key.toLowerCase() !== 'k') return false;
				if (!link) return false;

				event.preventDefault();

				const { state, dispatch } = view;
				const { selection } = state;
				const { from, to, empty } = selection;

				let selFrom = from;
				let selTo = to;

				if (empty) {
					const range = wordRangeAtCursor(state);

					if (range) {
						selFrom = range.from;
						selTo = range.to;
					} else {
						const href0 = promptUrl();
						if (!href0) return true;

						const mark = link.create({ href: href0 });
						let tr = state.tr.insertText(href0, from, to);
						tr = tr.addMark(from, from + href0.length, mark);
						tr = tr.setSelection(selectionAt(tr, from + href0.length));
						dispatch(tr.scrollIntoView());
						return true;
					}
				}

				const initialHref = findExistingLinkHref(state, selFrom, selTo, link);
				const href = promptUrl(initialHref ?? '');
				if (!href) return true;

				let tr = state.tr.removeMark(selFrom, selTo, link);
				tr = tr.addMark(selFrom, selTo, link.create({ href }));
				tr = tr.setSelection(selectionAt(tr, selTo));
				dispatch(tr.scrollIntoView());
				return true;
			}
		},

		appendTransaction(
			transactions: readonly Transaction[],
			_oldState: EditorState,
			newState: EditorState
		): Transaction | null {
			if (!transactions.some((tr) => isSingleCharTextInsertion(tr))) return null;

			const sel = newState.selection;
			if (!sel.empty) return null;

			const $from = sel.$from;
			if (!$from.parent.isTextblock) return null;

			const parentStart = $from.start();
			const text = $from.parent.textContent;
			const offset = $from.parentOffset;
			const before = text.slice(0, offset);

			if (strong) {
				const match = /(\*\*)([^*\n]+)\*\*$/.exec(before);
				if (match) {
					const full = match[0];
					const content = match[2];
					if (!content) return null;

					const start = offset - full.length;
					const fullFrom = parentStart + start;
					const fullTo = fullFrom + full.length;

					const tr = replaceWrappedTextWithMark(
						newState.tr,
						fullFrom,
						fullTo,
						content,
						strong
					);

					return tr.setSelection(selectionAt(tr, fullFrom + content.length));
				}
			}

			if (em) {
				const match =
					/(^|[^*])\*([^*\n]+)\*$/.exec(before) ||
					/(^|[^_])_([^_\n]+)_$/.exec(before);

				if (match) {
					const prefix = match[1] ?? '';
					const content = match[2];
					const full = match[0];

					if (!content) return null;

					const fullStart = offset - full.length;
					const wrappedStart = fullStart + prefix.length;

					const fullFrom = parentStart + wrappedStart;
					const fullTo = fullFrom + (full.length - prefix.length);

					const tr = replaceWrappedTextWithMark(
						newState.tr,
						fullFrom,
						fullTo,
						content,
						em
					);

					return tr.setSelection(selectionAt(tr, fullFrom + content.length));
				}
			}

			if (code) {
				const match = /`([^`\n]+)`$/.exec(before);
				if (match) {
					const full = match[0];
					const content = match[1];
					if (!content) return null;

					const start = offset - full.length;
					const fullFrom = parentStart + start;
					const fullTo = fullFrom + full.length;

					const tr = replaceWrappedTextWithMark(
						newState.tr,
						fullFrom,
						fullTo,
						content,
						code
					);

					return tr.setSelection(selectionAt(tr, fullFrom + content.length));
				}
			}

			if (link) {
				const match = /\[([^\]\n]+)\]\(([^()\n]+)\)$/.exec(before);
				if (match) {
					const full = match[0];
					const label = match[1];
					const hrefRaw = match[2];

					if (!label || !hrefRaw) return null;

					const href = normalizeHref(hrefRaw);
					if (!href) return null;

					const start = offset - full.length;
					const fullFrom = parentStart + start;
					const fullTo = fullFrom + full.length;

					const tr = replaceWrappedTextWithMark(
						newState.tr,
						fullFrom,
						fullTo,
						label,
						link,
						{ href }
					);

					return tr.setSelection(selectionAt(tr, fullFrom + label.length));
				}
			}

			return null;
		}
	};

	return new Plugin(spec);
}