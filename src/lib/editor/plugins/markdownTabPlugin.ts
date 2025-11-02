import { Plugin, PluginKey } from 'prosemirror-state';
import { sinkListItem, liftListItem } from 'prosemirror-schema-list';
import type { Schema } from 'prosemirror-model';

/**
 * Tab and Shift+Tab to indent/unindent list levels.
 */
export function markdownTabPlugin(schema: Schema) {
	const key = new PluginKey('markdown-tab');
	const { list_item } = schema.nodes;

	return new Plugin({
		key,
		props: {
			handleKeyDown(view, event) {
				const { state, dispatch } = view;

				if (event.key === 'Tab') {
					event.preventDefault();
					sinkListItem(list_item)(state, dispatch);
					return true;
				}

				if (event.key === 'Tab' && event.shiftKey) {
					event.preventDefault();
					liftListItem(list_item)(state, dispatch);
					return true;
				}

				return false;
			}
		}
	});
}
