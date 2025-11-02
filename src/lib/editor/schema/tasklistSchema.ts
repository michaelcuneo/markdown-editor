import { schema as baseMarkdownSchema } from 'prosemirror-markdown';
import { Schema, Node as PMNode } from 'prosemirror-model';

/**
 * Extend ProseMirror’s markdown schema to support GitHub-style task lists,
 * while keeping all default nodes (including horizontal_rule, etc.)
 */
export function createTaskListSchema(): Schema {
	const baseListItem = baseMarkdownSchema.spec.nodes.get('list_item')!;

	const nodes = baseMarkdownSchema.spec.nodes.update('list_item', {
		...baseListItem,
		attrs: { ...(baseListItem.attrs ?? {}), checked: { default: null } },
		parseDOM: [
			...(baseListItem.parseDOM ?? []),
			{
				tag: 'li[data-checked]',
				getAttrs: (dom: HTMLElement) => ({
					checked:
						dom.getAttribute('data-checked') === 'true'
							? true
							: dom.getAttribute('data-checked') === 'false'
								? false
								: null
				})
			}
		],
		toDOM(node: PMNode) {
			const { checked } = node.attrs as { checked: boolean | null };
			if (checked === null) return ['li', 0];
			return [
				'li',
				{ 'data-checked': String(checked) },
				[
					'label',
					{ class: 'pm-task' },
					[
						'input',
						{
							type: 'checkbox',
							disabled: true,
							checked: !!checked,
							class: 'pm-task-checkbox'
						}
					],
					['span', { class: 'pm-task-content' }, 0]
				]
			];
		}
	});

	// ✅ Ensure we preserve *all* original marks & nodes
	return new Schema({
		nodes,
		marks: baseMarkdownSchema.spec.marks
	});
}
