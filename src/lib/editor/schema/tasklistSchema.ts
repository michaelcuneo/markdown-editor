import { schema as baseMarkdownSchema } from 'prosemirror-markdown';
import { Schema, Node as PMNode } from 'prosemirror-model';

/**
 * Extend ProseMirror's default Markdown schema with GFM-style task list support.
 */
export function createTaskListSchema(): Schema {
	const baseListItem = baseMarkdownSchema.spec.nodes.get('list_item')!;

	const nodes = baseMarkdownSchema.spec.nodes.update('list_item', {
		...baseListItem,
		attrs: {
			...(baseListItem.attrs ?? {}),
			checked: { default: null }
		},
		parseDOM: [
			...(baseListItem.parseDOM ?? []),
			{
				tag: 'li[data-checked]',
				getAttrs: (dom: HTMLElement) => {
					const val = dom.getAttribute('data-checked');
					return {
						checked: val === 'true' ? true : val === 'false' ? false : null
					};
				}
			}
		],
		toDOM(node: PMNode) {
			const { checked } = node.attrs as { checked: boolean | null };

			// 🟢 Normal bullet list item
			if (checked === null) return ['li', 0];

			// 🟢 Task list item with checkbox
			const checkbox = [
				'input',
				{
					type: 'checkbox',
					disabled: true,
					checked: !!checked,
					class: 'pm-task-checkbox'
				}
			];
			const content = ['span', { class: 'pm-task-content' }, 0];
			return [
				'li',
				{ 'data-checked': String(checked) },
				['label', { class: 'pm-task' }, checkbox, content]
			];
		}
	});

	const marks = baseMarkdownSchema.spec.marks.update('link', {
		...baseMarkdownSchema.spec.marks.get('link'),
		toDOM(mark) {
			return [
				'a',
				{
					href: mark.attrs.href,
					title: mark.attrs.title || null,
					class: 'pm-link',
					target: '_blank',
					rel: 'noopener noreferrer'
				},
				0
			];
		}
	});

	return new Schema({
		nodes,
		marks
	});
}
