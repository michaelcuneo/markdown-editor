// src/lib/editor/plugins/wysiwymPlugin.ts
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { Schema } from 'prosemirror-model';

function normalizeHref(href: string): string {
	const trimmed = href.trim();
	if (!trimmed) return '';
	if (/^[a-z]+:\/\//i.test(trimmed)) return trimmed;
	if (/^mailto:|^tel:/i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
}

/**
 * WYSIWYM inline Markdown plugin.
 * Converts **bold**, *italic* / _italic_, `code`, and [text](url) while typing.
 * Adds Mod/Cmd+K to insert/edit links.
 */
export function wysiwymPlugin(schema: Schema) {
	const key = new PluginKey('wysiwymMarkdown');

	const strong = schema.marks.strong;
	const em = schema.marks.em;
	const code = schema.marks.code;
	const link = schema.marks.link;

	return new Plugin({
		key,

		props: {
			// Mod/Cmd + K → prompt for link and apply to selection
			handleKeyDown(view, event) {
				const isMod = event.metaKey || event.ctrlKey;
				if (!isMod) return false;
				if (event.key.toLowerCase() !== 'k') return false;
				if (!link) return false;

				event.preventDefault();

				// --- inside handleKeyDown(view, event)
				const { state, dispatch } = view;
				const { selection } = state;
				const { from, to, empty } = selection;

				// If nothing selected → try to expand to the word under cursor
				let selFrom = from;
				let selTo = to;

				if (empty) {
					const $pos = state.selection.$from;
					const parent = $pos.parent;
					if (!parent.isTextblock) return false;

					const text = parent.textContent ?? '';
					const off = $pos.parentOffset;

					// Expand to word under cursor
					const left = text.slice(0, off).search(/\S+$/);
					const rightMatch = text.slice(off).match(/^\S+/);
					const right = rightMatch ? off + rightMatch[0].length : off;

					if (left !== -1 && right > off) {
						selFrom = $pos.start() + left;
						selTo = $pos.start() + right;
					} else {
						// Nothing selected, just insert a new link directly
						const url0 = normalizeHref(prompt('Enter URL:') || '');
						if (!url0) return true;
						const mark = link.create({ href: url0 });
						const trEmpty = state.tr
							.insertText(url0, from, to)
							.addMark(from, from + url0.length, mark);
						dispatch(trEmpty.scrollIntoView());
						return true;
					}
				}

				// Try to read any existing link mark at the selection start
				const $left = state.doc.resolve(selFrom);
				const marksHere = $left.marks();
				const existingMark = marksHere.find((m) => m.type === link);
				const initialHref = existingMark?.attrs?.href as string | undefined;

				// Prompt for new or updated URL
				const href = normalizeHref(prompt('Enter URL:', initialHref ?? '') || '');
				if (!href) return true;

				const mark = link.create({ href });
				const tr = state.tr
					.addMark(selFrom, selTo, mark)
					.setSelection(TextSelection.create(state.doc, selTo));
				dispatch(tr.scrollIntoView());
				return true;
			}
		},

		appendTransaction(transactions, _oldState, newState) {
			if (!transactions.some((tr) => tr.docChanged)) return null;
			const tr = newState.tr;

			const sel = newState.selection;
			const $from = sel.$from;
			if (!$from.parent.isTextblock) return null;

			const parentStart = $from.start();
			const text = $from.parent.textContent ?? '';
			const offset = $from.parentOffset;
			const before = text.slice(0, offset);

			// --- **strong**
			if (strong) {
				const m = /(\*\*)([^*]+)\*\*$/.exec(before);
				if (m) {
					const [full, , content] = m;
					const start = offset - full.length;
					const openFrom = parentStart + start;
					const innerFrom = openFrom + 2;
					const innerTo = innerFrom + content.length;

					tr.delete(innerTo, innerTo + 2); // closing **
					tr.delete(openFrom, openFrom + 2); // opening **
					tr.addMark(innerFrom - 2, innerTo - 2, strong.create()); // adjust after deletes
					return tr;
				}
			}

			// --- _emphasis_ or *emphasis*
			if (em) {
				const m = /(?<!\*)_([^_]+)_(?!_)$/.exec(before) || /(?<!\*)\*([^*]+)\*(?!\*)$/.exec(before);
				if (m) {
					const [full, content] = m;
					const start = offset - full.length;
					const openFrom = parentStart + start;
					const innerFrom = openFrom + 1;
					const innerTo = innerFrom + content.length;

					tr.delete(innerTo, innerTo + 1); // closing
					tr.delete(openFrom, openFrom + 1); // opening
					tr.addMark(innerFrom - 1, innerTo - 1, em.create()); // adjust after deletes
					return tr;
				}
			}

			// --- `code`
			if (code) {
				const m = /`([^`]+)`$/.exec(before);
				if (m) {
					const [full, content] = m;
					const start = offset - full.length;
					const openFrom = parentStart + start;
					const innerFrom = openFrom + 1;
					const innerTo = innerFrom + content.length;

					tr.delete(innerTo, innerTo + 1); // closing `
					tr.delete(openFrom, openFrom + 1); // opening `
					tr.addMark(innerFrom - 1, innerTo - 1, code.create()); // adjust after deletes
					return tr;
				}
			}

			// --- [text](url)
			if (link) {
				const m = /\[([^\]]+)\]\(([^)]+)\)$/.exec(before);
				if (m) {
					const [full, label, hrefRaw] = m;
					const start = offset - full.length;
					const fullFrom = parentStart + start;
					const fullTo = fullFrom + full.length;

					const href = normalizeHref(hrefRaw);
					const mark = link.create({ href });

					// Remove the whole [text](url)
					tr.delete(fullFrom, fullTo);

					// Insert just the label text at fullFrom
					tr.insertText(label, fullFrom);

					// Apply link mark to that inserted label
					tr.addMark(fullFrom, fullFrom + label.length, mark);

					return tr.scrollIntoView();
				}
			}

			return null;
		}
	});
}
