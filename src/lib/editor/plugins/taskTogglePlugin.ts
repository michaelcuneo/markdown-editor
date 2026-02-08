import { Plugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

export function taskTogglePlugin() {
	return new Plugin({
		props: {
			handleClick(view: EditorView, pos: number, event: MouseEvent) {
				const target = event.target as HTMLElement | null;
				if (!target) return false;

				// ✅ only our task toggle
				if (target.tagName !== 'INPUT') return false;
				const checkbox = target as HTMLInputElement;
				if (checkbox.type !== 'checkbox') return false;
				if (checkbox.dataset.role !== 'task-toggle') return false;

				// prevent native focus/scroll behavior
				event.preventDefault();
				event.stopPropagation();

				const { state, dispatch } = view;
				const $pos = state.doc.resolve(pos);

				for (let depth = $pos.depth; depth > 0; depth--) {
					const node = $pos.node(depth);

					// your tasks are list_item with checked attr
					if (node.type.name === 'list_item' && typeof node.attrs.checked === 'boolean') {
						const itemPos = $pos.before(depth);
						const newChecked = !node.attrs.checked;

						const tr = state.tr.setNodeMarkup(itemPos, node.type, {
							...node.attrs,
							checked: newChecked
						});

						// ✅ preserve window scroll to kill the page jump
						const x = window.scrollX;
						const y = window.scrollY;

						dispatch(tr); // ✅ NO scrollIntoView()

						// keep focus on editor without scrolling
						(view.dom as HTMLElement).focus?.({ preventScroll: true } as FocusOptions);

						queueMicrotask(() => window.scrollTo(x, y));

						view.dom.dispatchEvent(new CustomEvent('pm-updated', { bubbles: true }));
						return true;
					}
				}

				return false;
			}
		}
	});
}
