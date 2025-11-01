import { Plugin, PluginKey } from 'prosemirror-state';
import type { Schema, Node as PMNode, ResolvedPos } from 'prosemirror-model';
import { splitListItem, liftListItem } from 'prosemirror-schema-list';

function findAncestorDepthOf(nodeName: string, $pos: ResolvedPos): number | null {
	for (let d = $pos.depth; d > 0; d--) {
		if ($pos.node(d).type.name === nodeName) return d;
	}
	return null;
}

/**
 * Enter behavior:
 * - In a list item with text → split; if it's a task item, new item is unchecked.
 * - In an empty list item → lift (exit the list).
 */
export function markdownEnterPlugin(schema: Schema) {
	const key = new PluginKey('markdown-enter');

	const listItem = schema.nodes.list_item;
	if (!listItem) {
		console.warn('[markdownEnterPlugin] Schema has no list_item.');
		return new Plugin({ key });
	}

	return new Plugin({
		key,
		props: {
			handleKeyDown(view, event) {
				if (event.key !== 'Enter') return false;

				const { state, dispatch } = view;
				const { selection } = state;
				const { $from } = selection;

				const liDepth = findAncestorDepthOf('list_item', $from);
				if (liDepth == null) return false;

				const liPos = $from.before(liDepth);
				const liNode: PMNode = state.doc.nodeAt(liPos)!;

				// Paragraph inside the LI (where the cursor is)
				const inPara = $from.parent?.type.name === 'paragraph' ? $from.parent : null;
				const inParaIsEmpty = !!inPara && inPara.textContent.trim().length === 0;

				// Empty LI → exit (lift) the list
				if (inParaIsEmpty) {
					if (liftListItem(listItem)(state, dispatch)) {
						event.preventDefault();
						return true;
					}
					return false;
				}

				// Non-empty LI → split
				if (splitListItem(listItem)(state, dispatch)) {
					event.preventDefault();

					// If current is a task (checked !== null), ensure the NEW LI is unchecked
					const afterSplitState = view.state;
					const { $from: $after } = afterSplitState.selection;
					const newDepth = findAncestorDepthOf('list_item', $after);
					if (newDepth != null) {
						const newLiPos = $after.before(newDepth);
						const newLiNode = afterSplitState.doc.nodeAt(newLiPos);
						if (newLiNode && liNode.attrs && liNode.attrs.checked !== null) {
							const tr = afterSplitState.tr.setNodeMarkup(
								newLiPos,
								listItem,
								{ ...newLiNode.attrs, checked: false },
								newLiNode.marks
							);
							view.dispatch(tr);
						}
					}
					return true;
				}

				return false;
			}
		}
	});
}
