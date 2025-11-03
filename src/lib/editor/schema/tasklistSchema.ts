import { schema as baseMarkdownSchema } from 'prosemirror-markdown';
import { Schema, Node as PMNode } from 'prosemirror-model';

export function createTaskListSchema(): Schema {
	const baseListItem = baseMarkdownSchema.spec.nodes.get('list_item')!;
	const baseImage = baseMarkdownSchema.spec.nodes.get('image')!;

	const nodes = baseMarkdownSchema.spec.nodes
		.update('list_item', {
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
				const { checked } = node.attrs;
				if (checked === null) return ['li', 0];
				return [
					'li',
					{ 'data-checked': String(checked) },
					[
						'label',
						{ class: 'pm-task' },
						[
							'input',
							{ type: 'checkbox', disabled: true, checked: !!checked, class: 'pm-task-checkbox' }
						],
						['span', { class: 'pm-task-content' }, 0]
					]
				];
			}
		})
		.update('image', {
			...baseImage,
			toDOM(node: PMNode) {
				const src = node.attrs.src ?? '';
				const map =
					(window as { __imagePreviewMap?: Record<string, string> }).__imagePreviewMap ?? {};
				const preview = map[src] || src;

				return [
					'img',
					{
						src: preview,
						alt: node.attrs.alt ?? '',
						class: 'pm-image',
						draggable: true,
						'data-id': src
					}
				];
			}
		});

	return new Schema({ nodes, marks: baseMarkdownSchema.spec.marks });
}
