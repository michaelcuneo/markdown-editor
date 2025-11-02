import { Plugin, PluginKey } from 'prosemirror-state';
import { liftTarget } from 'prosemirror-transform';
import type { Schema } from 'prosemirror-model';

/**
 * Smart Delete (forward delete) behavior for lists.
 * Merges current item with next item or unwraps list safely.
 */
export function markdownDeletePlugin(schema: Schema) {
	const key = new PluginKey('markdown-delete');
	const { list_item, bullet_list, ordered_list } = schema.nodes;

	return new Plugin({
		key,
		props: {
			handleKeyDown(view, event) {
				if (event.key !== 'Delete') return false;

				const { state, dispatch } = view;
				const { selection } = state;
				const { $from } = selection;

				// Only handle at end of block
				if (!selection.empty || $from.parentOffset < $from.parent.content.size) return false;

				let depth = $from.depth;
				while (depth > 0 && $from.node(depth).type !== list_item) depth--;
				if (depth <= 0) return false;

				const itemNode = $from.node(depth);
				const parentList = $from.node(depth - 1);
				if (![bullet_list, ordered_list].includes(parentList.type)) return false;

				const listIndex = $from.index(depth - 1);
				const nextItem =
					listIndex + 1 < parentList.childCount ? parentList.child(listIndex + 1) : null;
				const itemPos = $from.before(depth);

				// Merge with next item
				if (nextItem) {
					event.preventDefault();
					const nextPos = itemPos + itemNode.nodeSize;
					const tr = state.tr.join(nextPos);
					dispatch(tr.scrollIntoView());
					return true;
				}

				// End of list → lift to paragraph
				const range = state.doc.resolve(itemPos).blockRange($from);
				const target = range ? liftTarget(range) : null;
				if (target != null) {
					event.preventDefault();
					if (range) {
						const tr = state.tr.lift(range, target);
						dispatch(tr.scrollIntoView());
						return true;
					}
				}

				return false;
			}
		}
	});
}
