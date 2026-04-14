import { schema as baseMarkdownSchema } from 'prosemirror-markdown';
import { Schema, type DOMOutputSpec, type Node as PMNode } from 'prosemirror-model';

type AlignValue = 'left' | 'center' | 'right' | null;

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

function normalizeAlign(value: unknown): AlignValue {
	if (value === 'left' || value === 'center' || value === 'right') {
		return value;
	}
	return null;
}

function getAlignFromDom(dom: HTMLElement): AlignValue {
	return normalizeAlign(dom.getAttribute('align')?.toLowerCase() ?? null);
}

function buildAlignAttrs(node: PMNode): Record<string, string> | null {
	const align = normalizeAlign(node.attrs.align);
	return align ? { align } : null;
}

export function createTaskListSchema(): Schema {
	const baseListItem = baseMarkdownSchema.spec.nodes.get('list_item');
	const baseImage = baseMarkdownSchema.spec.nodes.get('image');
	const baseParagraph = baseMarkdownSchema.spec.nodes.get('paragraph');
	const baseHeading = baseMarkdownSchema.spec.nodes.get('heading');
	const baseBlockquote = baseMarkdownSchema.spec.nodes.get('blockquote');

	if (!baseListItem) {
		throw new Error('Base markdown schema is missing list_item');
	}

	if (!baseImage) {
		throw new Error('Base markdown schema is missing image');
	}

	if (!baseParagraph) {
		throw new Error('Base markdown schema is missing paragraph');
	}

	if (!baseHeading) {
		throw new Error('Base markdown schema is missing heading');
	}

	if (!baseBlockquote) {
		throw new Error('Base markdown schema is missing blockquote');
	}

	const nodes = baseMarkdownSchema.spec.nodes
		.update('paragraph', {
			...baseParagraph,
			attrs: {
				...(baseParagraph.attrs ?? {}),
				align: { default: null }
			},
			parseDOM: [
				{
					tag: 'p[align]',
					getAttrs(dom) {
						if (!(dom instanceof HTMLElement)) return false;
						return {
							align: getAlignFromDom(dom)
						};
					}
				},
				...(baseParagraph.parseDOM ?? [])
			],
			toDOM(node: PMNode): DOMOutputSpec {
				return ['p', buildAlignAttrs(node) ?? {}, 0];
			}
		})
		.update('heading', {
			...baseHeading,
			attrs: {
				...(baseHeading.attrs ?? {}),
				align: { default: null }
			},
			parseDOM: [
				{
					tag: 'h1[align]',
					getAttrs: (dom) =>
						dom instanceof HTMLElement ? { level: 1, align: getAlignFromDom(dom) } : false
				},
				{
					tag: 'h2[align]',
					getAttrs: (dom) =>
						dom instanceof HTMLElement ? { level: 2, align: getAlignFromDom(dom) } : false
				},
				{
					tag: 'h3[align]',
					getAttrs: (dom) =>
						dom instanceof HTMLElement ? { level: 3, align: getAlignFromDom(dom) } : false
				},
				{
					tag: 'h4[align]',
					getAttrs: (dom) =>
						dom instanceof HTMLElement ? { level: 4, align: getAlignFromDom(dom) } : false
				},
				{
					tag: 'h5[align]',
					getAttrs: (dom) =>
						dom instanceof HTMLElement ? { level: 5, align: getAlignFromDom(dom) } : false
				},
				{
					tag: 'h6[align]',
					getAttrs: (dom) =>
						dom instanceof HTMLElement ? { level: 6, align: getAlignFromDom(dom) } : false
				},
				...(baseHeading.parseDOM ?? [])
			],
			toDOM(node: PMNode): DOMOutputSpec {
				const level = Math.max(1, Math.min(6, Number(node.attrs.level) || 1));
				return [`h${level}`, buildAlignAttrs(node) ?? {}, 0];
			}
		})
		.update('blockquote', {
			...baseBlockquote,
			attrs: {
				...(baseBlockquote.attrs ?? {}),
				align: { default: null }
			},
			parseDOM: [
				{
					tag: 'blockquote[align]',
					getAttrs(dom) {
						if (!(dom instanceof HTMLElement)) return false;
						return {
							align: getAlignFromDom(dom)
						};
					}
				},
				...(baseBlockquote.parseDOM ?? [])
			],
			toDOM(node: PMNode): DOMOutputSpec {
				return ['blockquote', buildAlignAttrs(node) ?? {}, 0];
			}
		})
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
