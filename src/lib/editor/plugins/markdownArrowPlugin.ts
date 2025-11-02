import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { Schema } from 'prosemirror-model';

/**
 * Smart Arrow Up / Down inside and around lists.
 * Escapes from start or end of lists smoothly.
 */
export function markdownArrowPlugin(schema: Schema) {
	const key = new PluginKey('markdown-arrows');
	const { list_item } = schema.nodes;

	return new Plugin({
		key,
		props: {
			handleKeyDown(view, event) {
				const { state, dispatch } = view;
				const { selection } = state;
				const { $from } = selection;

				if (!selection.empty) return false;

				// --- Move out of list when at top/bottom boundary
				if (event.key === 'ArrowUp') {
					const prev = state.doc.resolve($from.before()).nodeBefore;
					if (!$from.node(-1) || $from.node(-1).type !== list_item) return false;
					if (!prev) {
						// At top of list → move cursor before
						event.preventDefault();
						const beforePos = $from.before($from.depth - 1);
						const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(beforePos), -1));
						dispatch(tr.scrollIntoView());
						return true;
					}
				}

				if (event.key === 'ArrowDown') {
					const next = state.doc.resolve($from.after()).nodeAfter;
					if (!$from.node(-1) || $from.node(-1).type !== list_item) return false;
					if (!next) {
						// At end of list → move cursor after
						event.preventDefault();
						const afterPos = $from.after($from.depth - 1);
						const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(afterPos)));
						dispatch(tr.scrollIntoView());
						return true;
					}
				}

				return false;
			}
		}
	});
}
