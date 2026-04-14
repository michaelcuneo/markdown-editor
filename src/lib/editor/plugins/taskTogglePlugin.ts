import { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

export function taskTogglePlugin() {
	return new Plugin({
		props: {
			handleClick(view: EditorView, pos: number, event: MouseEvent) {
				const target = event.target as HTMLElement | null;
				if (!target || target.tagName !== 'INPUT') return false;

				const checkbox = target as HTMLInputElement;
				if (checkbox.type !== 'checkbox') return false;

				const { state, dispatch } = view;
				const $pos = state.doc.resolve(pos);

				for (let depth = $pos.depth; depth > 0; depth--) {
					const node = $pos.node(depth);
					if (node.type.name === 'list_item' && node.attrs.checked !== null) {
						const itemPos = $pos.before(depth);
						const newChecked = !node.attrs.checked;

						const tr = state.tr.setNodeMarkup(itemPos, node.type, {
							...node.attrs,
							checked: newChecked
						});

						dispatch(tr.scrollIntoView());

						view.dom.dispatchEvent(new CustomEvent('pm-updated', { bubbles: true }));
						return true;
					}
				}

				return false;
			}
		}
	});
}
