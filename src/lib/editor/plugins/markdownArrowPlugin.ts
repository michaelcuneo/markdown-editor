import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { Schema, NodeType } from 'prosemirror-model';
import type { ResolvedPos } from 'prosemirror-model';

function findAncestorDepth($pos: ResolvedPos, nodeType: NodeType): number | null {
	for (let depth = $pos.depth; depth > 0; depth -= 1) {
		if ($pos.node(depth).type === nodeType) {
			return depth;
		}
	}
	return null;
}

function isAtStartOfTextblock($pos: ResolvedPos): boolean {
	return $pos.parent.isTextblock && $pos.parentOffset === 0;
}

function isAtEndOfTextblock($pos: ResolvedPos): boolean {
	return $pos.parent.isTextblock && $pos.parentOffset === $pos.parent.content.size;
}

/**
 * Smart Arrow Up / Down inside and around lists.
 * Escapes from the first/last list item when the cursor is
 * at the start/end of the current textblock.
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
				if (!list_item) return false;

				const listItemDepth = findAncestorDepth($from, list_item);
				if (listItemDepth == null) return false;

				const listDepth = listItemDepth - 1;
				if (listDepth < 1) return false;

				const listNode = $from.node(listDepth);
				const itemIndex = $from.index(listDepth);

				if (event.key === 'ArrowUp') {
					if (!isAtStartOfTextblock($from)) return false;
					if (itemIndex !== 0) return false;

					event.preventDefault();

					const beforeListPos = $from.before(listDepth);
					const tr = state.tr.setSelection(
						TextSelection.near(state.doc.resolve(beforeListPos), -1)
					);

					dispatch(tr.scrollIntoView());
					return true;
				}

				if (event.key === 'ArrowDown') {
					if (!isAtEndOfTextblock($from)) return false;
					if (itemIndex !== listNode.childCount - 1) return false;

					event.preventDefault();

					const afterListPos = $from.after(listDepth);
					const tr = state.tr.setSelection(
						TextSelection.near(state.doc.resolve(afterListPos), 1)
					);

					dispatch(tr.scrollIntoView());
					return true;
				}

				return false;
			}
		}
	});
}