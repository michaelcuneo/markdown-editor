import { Plugin, PluginKey, Selection } from 'prosemirror-state';
import { splitListItem, liftListItem } from 'prosemirror-schema-list';
import type { Schema, Node as PMNode, NodeType, ResolvedPos } from 'prosemirror-model';

function findAncestorDepth($pos: ResolvedPos, nodeType: NodeType): number | null {
	for (let depth = $pos.depth; depth > 0; depth -= 1) {
		if ($pos.node(depth).type === nodeType) return depth;
	}
	return null;
}

function isStructurallyEmptyListItem(itemNode: PMNode, paragraphType?: NodeType): boolean {
	if (!paragraphType) return false;
	if (itemNode.childCount !== 1) return false;

	const firstChild = itemNode.firstChild;
	if (!firstChild) return false;
	if (firstChild.type !== paragraphType) return false;

	return firstChild.content.size === 0;
}

function getFenceLanguage(text: string): string | null {
	const match = /^```([a-zA-Z0-9_+-]*)$/.exec(text);
	if (!match) return null;
	return (match[1] ?? '').toLowerCase();
}

function hasCheckedAttr(node: PMNode): boolean {
	return Object.prototype.hasOwnProperty.call(node.attrs, 'checked');
}

export function markdownEnterPlugin(schema: Schema) {
	const key = new PluginKey('markdown-enter');
	const { list_item, paragraph, code_block } = schema.nodes;

	return new Plugin({
		key,
		props: {
			handleKeyDown(view, event) {
				if (event.key !== 'Enter') return false;

				const { state, dispatch } = view;
				const { selection } = state;
				const { $from } = selection;

				if (!selection.empty) return false;

				if (
					paragraph &&
					code_block &&
					$from.parent.type === paragraph &&
					$from.parentOffset === $from.parent.content.size
				) {
					const text = $from.parent.textContent;
					const lang = getFenceLanguage(text.trim());

					if (lang != null) {
						event.preventDefault();

						const paraPos = $from.before();
						const codeNode = code_block.create(lang ? { params: lang } : null);

						let tr = state.tr.replaceWith(
							paraPos,
							paraPos + $from.parent.nodeSize,
							codeNode
						);

						const codeStart = tr.mapping.map(paraPos + 1);
						tr = tr.setSelection(Selection.near(tr.doc.resolve(codeStart)));
						dispatch(tr.scrollIntoView());
						return true;
					}
				}

				if (!list_item) return false;

				const listItemDepth = findAncestorDepth($from, list_item);
				if (listItemDepth == null) return false;

				const itemNode = $from.node(listItemDepth);

				if (isStructurallyEmptyListItem(itemNode, paragraph)) {
					event.preventDefault();
					return liftListItem(list_item)(state, dispatch);
				}

				const didSplit = splitListItem(list_item)(state, dispatch);
				if (!didSplit) return false;

				event.preventDefault();

				const nextState = view.state;
				const { $from: $after } = nextState.selection;
				const newDepth = findAncestorDepth($after, list_item);

				if (newDepth != null) {
					const newLiPos = $after.before(newDepth);
					const newLiNode = nextState.doc.nodeAt(newLiPos);

					if (newLiNode && hasCheckedAttr(newLiNode)) {
						const tr = nextState.tr.setNodeMarkup(
							newLiPos,
							newLiNode.type,
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