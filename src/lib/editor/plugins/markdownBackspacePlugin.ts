import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { liftTarget } from 'prosemirror-transform';
import type { Schema } from 'prosemirror-model';

export function markdownBackspacePlugin(schema: Schema) {
	const key = new PluginKey('markdown-backspace');
	const { list_item, bullet_list, ordered_list, paragraph } = schema.nodes;

	return new Plugin({
		key,
		props: {
			handleKeyDown(view, event) {
				if (event.key !== 'Backspace') return false;

				const { state, dispatch } = view;
				const { selection } = state;
				const { $from } = selection;

				// Only act when cursor is at start of text
				if (!selection.empty || $from.parentOffset > 0) return false;

				// Locate the current list item
				let depth = $from.depth;
				while (depth > 0 && $from.node(depth).type !== list_item) depth--;
				if (depth <= 0) return false;

				const itemNode = $from.node(depth);
				const parentList = $from.node(depth - 1);
				if (![bullet_list, ordered_list].includes(parentList.type)) return false;

				const listIndex = $from.index(depth - 1);
				const prevItem = listIndex > 0 ? parentList.child(listIndex - 1) : null;
				const itemPos = $from.before(depth);
				const listPos = $from.before(depth - 1);

				event.preventDefault();
				const tr = state.tr;

				// 🧠 CASE 1: Empty item → remove it
				if (itemNode.textContent.trim() === '') {
					tr.delete(itemPos, itemPos + itemNode.nodeSize);

					// Remove the list if empty
					const listAfter = tr.doc.nodeAt(listPos);
					if (listAfter && listAfter.childCount === 0) {
						tr.delete(listPos, listPos + listAfter.nodeSize);
					}

					// Move cursor before list or to previous item
					const cursorPos = prevItem ? Math.max(0, itemPos - 2) : Math.max(0, listPos - 1);

					tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos), -1));
					dispatch(tr.scrollIntoView());
					return true;
				}

				// 🧠 CASE 2: Nested lists — only lift paragraph
				const hasNestedList = itemNode.content.content.some(
					(child) => child.type === bullet_list || child.type === ordered_list
				);

				if (hasNestedList && $from.parent.type === paragraph) {
					const paraStart = $from.start();
					const paraEnd = $from.end();
					const range = tr.doc.resolve(paraStart).blockRange(tr.doc.resolve(paraEnd));
					if (range) {
						const target = liftTarget(range);
						if (target != null) {
							tr.lift(range, target);
							const liftedPos = tr.mapping.map($from.pos, -1);
							tr.setSelection(TextSelection.near(tr.doc.resolve(liftedPos), -1));
							dispatch(tr.scrollIntoView());
							return true;
						}
					}
					return false;
				}

				// 🧠 CASE 3: Normal list item unwrap
				const itemStart = $from.before(depth);
				const itemEnd = itemStart + itemNode.nodeSize;
				const range = tr.doc.resolve(itemStart).blockRange(tr.doc.resolve(itemEnd));
				const target = range ? liftTarget(range) : null;

				if (target != null) {
					const targetNode = $from.node(target);
					if (targetNode.type === parentList.type) return false;

					tr.lift(range!, target);

					// ✅ Re-map selection safely after lift
					const liftedPos = tr.mapping.map($from.pos, -1);
					const $lifted = tr.doc.resolve(Math.max(0, liftedPos));
					tr.setSelection(TextSelection.near($lifted, -1));

					dispatch(tr.scrollIntoView());
					return true;
				}

				return false;
			}
		}
	});
}
