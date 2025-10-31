import { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/**
 * 🧩 Plugin: Allow toggling task checkboxes with click
 */
export function taskListPlugin() {
	return new Plugin({
		props: {
			handleDOMEvents: {
				click(view: EditorView, event: MouseEvent) {
					const target = event.target as HTMLElement;
					if (target.tagName === 'INPUT' && target.closest('li[data-task-item]')) {
						const li = target.closest('li[data-task-item]')!;
						const pos = view.posAtDOM(li, 0);
						const node = view.state.doc.nodeAt(pos);
						if (!node || node.type.name !== 'task_item') return false;

						const checked = !node.attrs.checked;
						const tr = view.state.tr.setNodeMarkup(pos, undefined, {
							...node.attrs,
							checked
						});
						view.dispatch(tr);
						return true;
					}
					return false;
				}
			}
		}
	});
}
