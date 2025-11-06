import { Plugin, PluginKey } from 'prosemirror-state';
import { splitListItem, liftListItem } from 'prosemirror-schema-list';
import type { Schema, ResolvedPos } from 'prosemirror-model';

function findAncestorDepthOf(nodeName: string, $pos: ResolvedPos): number | null {
	for (let d = $pos.depth; d > 0; d--) {
		if ($pos.node(d).type.name === nodeName) return d;
	}
	return null;
}

/**
 * Enhanced Enter plugin:
 * - Splits list items or creates new unchecked tasks
 * - Exits list if empty (lift)
 * - Handles ``` fence creation
 * - Inserts paragraph after HR / code_block
 * - Works with nested lists
 */
export function markdownEnterPlugin(schema: Schema) {
	const key = new PluginKey('markdown-enter');
	const { list_item, paragraph } = schema.nodes;

	return new Plugin({
		key,
		props: {
			handleKeyDown(view, event) {
				const { state, dispatch } = view;
				const { $from } = state.selection;

				if (event.key !== 'Enter') return false;

				// 🧠 Handle code fences ```lang
				if ($from.parent.type.name === 'paragraph') {
					const paraText = $from.parent.textContent.trim();
					const match = /^```([a-zA-Z0-9_+-]*)$/.exec(paraText);
					if (match) {
						event.preventDefault();
						const lang = match[1]?.toLowerCase() || '';
						const from = $from.start();
						const to = $from.end();

						let tr = state.tr.delete(from, to);
						const code = schema.nodes.code_block?.create({ params: lang });
						if (code) {
							tr = tr.insert(from, code);
						}
						dispatch(tr.scrollIntoView());
						return true;
					}
				}

				const depth = findAncestorDepthOf('list_item', $from);

				// 🧠 Not inside list — allow default paragraph split
				if (depth == null) {
					const nodeBefore = $from.nodeBefore;
					if (
						nodeBefore &&
						(nodeBefore.type.name === 'horizontal_rule' || nodeBefore.type.name === 'code_block')
					) {
						event.preventDefault();
						if (paragraph) {
							const tr = state.tr.insert($from.pos, paragraph.create());
							dispatch(tr.scrollIntoView());
							return true;
						}
					}
					return false;
				}

				const item = $from.node(depth);

				// 🧩 Empty list item → exit list
				if (item.textContent.trim() === '') {
					event.preventDefault();
					if (list_item) liftListItem(list_item)(state, dispatch);
					return true;
				}

				// 🧩 Otherwise split list item
				if (list_item && !splitListItem(list_item)(state, dispatch)) return false;

				event.preventDefault();

				// 🧩 If new item is a task → make unchecked
				const afterState = view.state;
				const { $from: $after } = afterState.selection;
				const newDepth = findAncestorDepthOf('list_item', $after);

				if (newDepth != null) {
					const newLiPos = $after.before(newDepth);
					const newLiNode = afterState.doc.nodeAt(newLiPos);
					if (newLiNode && newLiNode.attrs?.checked !== null) {
						const tr = afterState.tr.setNodeMarkup(
							newLiPos,
							list_item,
							{ ...newLiNode.attrs, checked: false },
							newLiNode.marks
						);
						view.dispatch(tr.scrollIntoView());
					}
				}

				return true;
			}
		}
	});
}
