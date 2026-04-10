import { schema as baseMarkdownSchema } from 'prosemirror-markdown';
import { Schema, type DOMOutputSpec, type Node as PMNode } from 'prosemirror-model';

function taskListItemToDOM(node: PMNode): DOMOutputSpec {
	const checked = node.attrs.checked;

	if (checked == null) {
		return ['li', 0];
	}

	return [
		'li',
		{
			'data-checked': String(checked),
			class: 'pm-task-item'
		},
		[
			'input',
			{
				type: 'checkbox',
				class: 'pm-task-checkbox',
				'data-role': 'task-toggle',
				checked: checked ? 'checked' : undefined
			}
		],
		['div', { class: 'pm-task-content' }, 0]
	];
}

export function createTaskListSchema(): Schema {
	const baseListItem = baseMarkdownSchema.spec.nodes.get('list_item');
	const baseImage = baseMarkdownSchema.spec.nodes.get('image');

	if (!baseListItem) {
		throw new Error('Base markdown schema is missing list_item');
	}

	if (!baseImage) {
		throw new Error('Base markdown schema is missing image');
	}

	const nodes = baseMarkdownSchema.spec.nodes
		.update('list_item', {
			...baseListItem,
			attrs: {
				...(baseListItem.attrs ?? {}),
				checked: { default: null }
			},
			parseDOM: [
				{
					tag: 'li[data-checked]',
					getAttrs(dom) {
						if (!(dom instanceof HTMLElement)) return false;

						const raw = dom.getAttribute('data-checked');
						return {
							checked: raw === 'true' ? true : raw === 'false' ? false : null
						};
					}
				},
				...(baseListItem.parseDOM ?? [])
			],
			toDOM(node: PMNode): DOMOutputSpec {
				return taskListItemToDOM(node);
			}
		})
		.update('image', {
			...baseImage,
			toDOM(node: PMNode): DOMOutputSpec {
				return [
					'img',
					{
						src: node.attrs.src ?? '',
						alt: node.attrs.alt ?? '',
						title: node.attrs.title ?? '',
						class: 'pm-image',
						draggable: 'true',
						'data-id': node.attrs.src ?? ''
					}
				];
			}
		});

	return new Schema({
		nodes,
		marks: baseMarkdownSchema.spec.marks
	});
}