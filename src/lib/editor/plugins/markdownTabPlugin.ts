import { Plugin, PluginKey } from 'prosemirror-state';
import { sinkListItem, liftListItem } from 'prosemirror-schema-list';
import type { Schema } from 'prosemirror-model';

/**
 * Tab and Shift+Tab to indent/unindent list levels.
 *
 * Only intercepts the key when the list command actually handles it,
 * so normal focus navigation still works outside lists.
 */
export function markdownTabPlugin(schema: Schema) {
	const key = new PluginKey('markdown-tab');
	const { list_item } = schema.nodes;

	return new Plugin({
		key,
		props: {
			handleKeyDown(view, event) {
				if (event.key !== 'Tab') return false;
				if (!list_item) return false;

				const { state, dispatch } = view;

				if (event.shiftKey) {
					const handled = liftListItem(list_item)(state, dispatch);
					if (!handled) return false;

					event.preventDefault();
					return true;
				}

				const handled = sinkListItem(list_item)(state, dispatch);
				if (!handled) return false;

				event.preventDefault();
				return true;
			}
		}
	});
}