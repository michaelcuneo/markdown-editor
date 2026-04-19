import { schema as baseMarkdownSchema } from 'prosemirror-markdown';
import { Fragment, Schema, type DOMOutputSpec, type Node as PMNode } from 'prosemirror-model';
import { tableNodes } from 'prosemirror-tables';

type AlignValue = 'left' | 'center' | 'right' | null;

const IMAGE_PLACEHOLDER_SRC =
	'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function isLocalImageId(value: string): boolean {
	return /^\/?local-img-/.test(value);
}

function isUrlLike(value: string): boolean {
	if (/^https?:\/\//i.test(value)) return true;
	if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return true;
	if (/^\/\//.test(value)) return true;
	return false;
}

function normalizeCodeBlockTextContent(value: string): string {
	return value.endsWith('\n') ? value.slice(0, -1) : value;
}

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
	const baseParagraph = baseMarkdownSchema.spec.nodes.get('paragraph');
	const baseHeading = baseMarkdownSchema.spec.nodes.get('heading');
	const baseBlockquote = baseMarkdownSchema.spec.nodes.get('blockquote');
	const baseCodeBlock = baseMarkdownSchema.spec.nodes.get('code_block');

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

	if (!baseCodeBlock) {
		throw new Error('Base markdown schema is missing code_block');
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

	function getTableAlignFromDom(dom: HTMLElement): AlignValue {
		const styleAlign = dom.style.textAlign?.toLowerCase() ?? null;
		const attrAlign = dom.getAttribute('align')?.toLowerCase() ?? null;
		return normalizeAlign(styleAlign ?? attrAlign);
	}

	function setTableAlignAttr(value: unknown, attrs: Record<string, string>): void {
		const align = normalizeAlign(value);
		if (!align) return;

		const existingStyle = attrs.style?.trim();
		if (!existingStyle) {
			attrs.style = `text-align: ${align}`;
			return;
		}

		const needsSemicolon = !existingStyle.endsWith(';');
		attrs.style = `${existingStyle}${needsSemicolon ? ';' : ''} text-align: ${align}`;
	}

	function buildAlignAttrs(node: PMNode): Record<string, string> | null {
		const align = normalizeAlign(node.attrs.align);
		return align ? { align } : null;
	}

	function getCodeLanguageFromDom(dom: HTMLElement): string | null {
		const code = dom.querySelector('code');
		if (!(code instanceof HTMLElement)) return null;

		const className = code.className || '';
		const match = className.match(/(?:^|\s)language-([A-Za-z0-9_-]+)(?:\s|$)/);

		return match?.[1]?.toLowerCase() ?? null;
	}

	const nodes = baseMarkdownSchema.spec.nodes
		.append(
			tableNodes({
				tableGroup: 'block',
				cellContent: 'block+',
				cellAttributes: {
					align: {
						default: null,
						getFromDOM(dom) {
							if (!(dom instanceof HTMLElement)) return null;
							return getTableAlignFromDom(dom);
						},
						setDOMAttr(value, attrs) {
							setTableAlignAttr(value, attrs as Record<string, string>);
						}
					}
				}
			})
		)
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
						return { align: getAlignFromDom(dom) };
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
						return { align: getAlignFromDom(dom) };
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
			attrs: {
				...(baseImage.attrs ?? {}),
				previewSrc: { default: null },
				srcSet: { default: null },
				quality: { default: null },
				width: { default: null },
				height: { default: null }
			},
			parseDOM: [
				{
					tag: 'img[src]',
					getAttrs(dom) {
						if (!(dom instanceof HTMLElement)) return false;
						const rawSrc = dom.getAttribute('src') ?? '';
						// data-id holds the logical src (local-img-xxx or real URL)
						// when the rendered HTML was produced by toDOM
						const logicalSrc = dom.getAttribute('data-id') || rawSrc;
						const w = dom.getAttribute('width');
						const h = dom.getAttribute('height');
						const srcSet = dom.getAttribute('srcset');
						const qualityRaw = dom.getAttribute('data-quality');
						const quality = qualityRaw == null ? null : Number(qualityRaw);
						return {
							src: logicalSrc,
							alt: dom.getAttribute('alt') ?? '',
							title: dom.getAttribute('title') ?? '',
							srcSet,
							quality: Number.isFinite(quality) ? quality : null,
							width: w ? Number(w) : null,
							height: h ? Number(h) : null,
							previewSrc: null
						};
					}
				}
			],
			toDOM(node: PMNode): DOMOutputSpec {
				const logicalSrc = String(node.attrs.src ?? '');
				const previewSrc = typeof node.attrs.previewSrc === 'string' ? node.attrs.previewSrc : '';
				const isKeyBasedSrc =
					logicalSrc.length > 0 && !isLocalImageId(logicalSrc) && !isUrlLike(logicalSrc);
				const shouldUsePlaceholder = isKeyBasedSrc || isLocalImageId(logicalSrc);
				const renderSrc = previewSrc || (shouldUsePlaceholder ? IMAGE_PLACEHOLDER_SRC : logicalSrc);

				const attrs: Record<string, string> = {
					src: renderSrc,
					alt: node.attrs.alt ?? '',
					title: node.attrs.title ?? '',
					class: 'pm-image',
					draggable: 'true',
					'data-id': logicalSrc
				};
				if (node.attrs.srcSet) attrs.srcset = String(node.attrs.srcSet);
				if (node.attrs.quality != null) attrs['data-quality'] = String(node.attrs.quality);
				if (node.attrs.width) attrs.width = String(node.attrs.width);
				if (node.attrs.height) attrs.height = String(node.attrs.height);
				return ['img', attrs];
			}
		})
		.update('code_block', {
			...baseCodeBlock,
			attrs: {
				...(baseCodeBlock.attrs ?? {}),
				params: { default: '' }
			},
			parseDOM: [
				{
					tag: 'pre',
					preserveWhitespace: 'full',
					getContent(dom, schema) {
						if (!(dom instanceof HTMLElement)) return Fragment.empty;

						const codeElement = dom.querySelector('code');
						const textContent = normalizeCodeBlockTextContent(
							codeElement?.textContent ?? dom.textContent ?? ''
						);

						return textContent.length > 0
							? Fragment.from(schema.text(textContent))
							: Fragment.empty;
					},
					getAttrs(dom) {
						if (!(dom instanceof HTMLElement)) return false;

						const params = getCodeLanguageFromDom(dom) ?? '';
						return { params };
					}
				}
			],
			toDOM(node: PMNode): DOMOutputSpec {
				const params = typeof node.attrs.params === 'string' ? node.attrs.params.trim() : '';

				const codeAttrs = params ? { class: `language-${params}` } : {};
				return ['pre', ['code', codeAttrs, 0]];
			}
		});

	return new Schema({
		nodes,
		marks: baseMarkdownSchema.spec.marks
	});
}
