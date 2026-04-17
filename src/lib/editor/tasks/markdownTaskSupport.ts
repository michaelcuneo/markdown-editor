import {
	MarkdownParser,
	MarkdownSerializer,
	defaultMarkdownParser,
	defaultMarkdownSerializer
} from 'prosemirror-markdown';
import {
	DOMParser as PMDOMParser,
	Fragment,
	type Schema,
	type Node as PMNode
} from 'prosemirror-model';
import MarkdownIt from 'markdown-it';
import markdownItTables from '../utils/markdownItTables.js';

type AlignValue = 'left' | 'center' | 'right';
type MarkdownTaskSupport = {
	parser: MarkdownParser;
	serializer: MarkdownSerializer;
};

type MarkdownTaskSupportOptions = {
	allowHtml?: boolean;
};

type TableAlignValue = 'left' | 'center' | 'right' | null;

function escapeTableCellText(text: string): string {
	return text.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
}

function tableRowToCells(row: PMNode): string[] {
	const cells: string[] = [];

	for (let index = 0; index < row.childCount; index += 1) {
		cells.push(escapeTableCellText(row.child(index)?.textContent ?? ''));
	}

	return cells;
}

function writeTableRow(
	state: Parameters<NonNullable<typeof defaultMarkdownSerializer.nodes.paragraph>>[0],
	cells: string[]
): void {
	state.write(`| ${cells.join(' | ')} |`);
	state.ensureNewLine();
}

function tableSeparatorCell(align: unknown): string {
	if (align === 'left') return ':---';
	if (align === 'center') return ':---:';
	if (align === 'right') return '---:';
	return '---';
}

function getTableCellAlign(cell: PMNode | null | undefined): TableAlignValue {
	const align = cell?.attrs?.align;
	if (align === 'left' || align === 'center' || align === 'right') {
		return align;
	}

	return null;
}

const ALIGN_MARKER_PREFIX = '@@PM_ALIGN:';
const ALIGN_MARKER_SUFFIX = '@@';

function isListItem(node: PMNode): boolean {
	return node.type.name === 'list_item';
}

function isParagraph(node: PMNode | null | undefined): node is PMNode {
	return !!node && node.type.name === 'paragraph';
}

function extractTaskPrefix(text: string): { checked: boolean; length: number } | null {
	const match = /^\s*\[( |x|X)\]\s+/.exec(text);
	if (!match) return null;

	return {
		checked: (match[1] ?? '').toLowerCase() === 'x',
		length: match[0].length
	};
}

function makeAlignMarker(align: AlignValue): string {
	return `${ALIGN_MARKER_PREFIX}${align}${ALIGN_MARKER_SUFFIX}`;
}

function parseAlignMarker(text: string): AlignValue | null {
	const match = new RegExp(
		`^${ALIGN_MARKER_PREFIX}(left|center|right)${ALIGN_MARKER_SUFFIX}$`
	).exec(text.trim());
	return (match?.[1] as AlignValue | undefined) ?? null;
}

function isAlignmentMarkerParagraph(node: PMNode | null | undefined): AlignValue | null {
	if (!node || node.type.name !== 'paragraph' || node.childCount !== 1) return null;
	const child = node.firstChild;
	if (!child?.isText) return null;
	return parseAlignMarker(child.text ?? '');
}

function applyAlignmentToNode(node: PMNode, align: AlignValue): PMNode {
	if (!['paragraph', 'heading', 'blockquote'].includes(node.type.name)) {
		return node;
	}

	if (node.attrs.align === align) return node;

	return node.type.create({ ...node.attrs, align }, node.content, node.marks);
}

function preprocessAlignmentHtml(src: string, allowHtml: boolean): string {
	if (!allowHtml) return src;

	let next = src;

	next = next.replace(
		/<p\s+align="(left|center|right)"\s*>([\s\S]*?)<\/p>/gi,
		(_, align: AlignValue, content: string) => `${makeAlignMarker(align)}\n\n${content.trim()}\n\n`
	);

	next = next.replace(
		/<h([1-6])\s+align="(left|center|right)"\s*>([\s\S]*?)<\/h\1>/gi,
		(_, level: string, align: AlignValue, content: string) =>
			`${makeAlignMarker(align)}\n\n${'#'.repeat(Number(level))} ${content.trim()}\n\n`
	);

	next = next.replace(
		/<blockquote\s+align="(left|center|right)"\s*>([\s\S]*?)<\/blockquote>/gi,
		(_, align: AlignValue, content: string) => {
			const lines = content
				.trim()
				.split('\n')
				.map((line) => `> ${line}`)
				.join('\n');

			return `${makeAlignMarker(align)}\n\n${lines}\n\n`;
		}
	);

	return next;
}

function normalizeTasks(node: PMNode): PMNode {
	if (node.isText) return node;

	const normalizedChildren: PMNode[] = [];
	let childChanged = false;

	node.forEach((child: PMNode) => {
		const normalized = normalizeTasks(child);
		if (normalized !== child) childChanged = true;
		normalizedChildren.push(normalized);
	});

	const normalizedContent = childChanged ? Fragment.fromArray(normalizedChildren) : node.content;

	if (!isListItem(node)) {
		return childChanged ? node.copy(normalizedContent) : node;
	}

	const firstChild = normalizedChildren[0] ?? null;
	if (!isParagraph(firstChild)) {
		return childChanged ? node.copy(normalizedContent) : node;
	}

	const firstInline = firstChild.firstChild;
	if (!firstInline || !firstInline.isText) {
		return childChanged ? node.copy(normalizedContent) : node;
	}

	const text = firstInline.text ?? '';
	const taskPrefix = extractTaskPrefix(text);
	if (!taskPrefix) {
		return childChanged ? node.copy(normalizedContent) : node;
	}

	const trimmedText = text.slice(taskPrefix.length);

	const newInlines: PMNode[] = [];
	if (trimmedText.length > 0) {
		newInlines.push(node.type.schema.text(trimmedText, firstInline.marks));
	}

	for (let i = 1; i < firstChild.childCount; i += 1) {
		newInlines.push(firstChild.child(i));
	}

	const newParagraph = firstChild.type.create(
		firstChild.attrs,
		Fragment.fromArray(newInlines),
		firstChild.marks
	);

	const rebuiltChildren: PMNode[] = [newParagraph, ...normalizedChildren.slice(1)];
	const rebuiltContent = Fragment.fromArray(rebuiltChildren);

	const nextAttrs =
		node.attrs.checked === taskPrefix.checked
			? node.attrs
			: { ...node.attrs, checked: taskPrefix.checked };

	if (nextAttrs === node.attrs && !childChanged && newParagraph.eq(firstChild)) {
		return node;
	}

	return node.type.create(nextAttrs, rebuiltContent, node.marks);
}

function normalizeAlignmentMarkers(node: PMNode): PMNode {
	if (node.isText) return node;

	const normalizedChildren: PMNode[] = [];
	let childChanged = false;

	node.forEach((child: PMNode) => {
		const normalized = normalizeAlignmentMarkers(child);
		if (normalized !== child) childChanged = true;
		normalizedChildren.push(normalized);
	});

	const rebuiltChildren: PMNode[] = [];
	let rebuiltChanged = childChanged;

	for (let i = 0; i < normalizedChildren.length; i += 1) {
		const child = normalizedChildren[i];
		const align = isAlignmentMarkerParagraph(child);

		if (!align) {
			if (child) rebuiltChildren.push(child);
			continue;
		}

		const next = normalizedChildren[i + 1];
		if (!next) {
			rebuiltChanged = true;
			continue;
		}

		const alignedNext = applyAlignmentToNode(next, align);
		if (alignedNext !== next) rebuiltChanged = true;

		rebuiltChildren.push(alignedNext);
		i += 1;
	}

	if (!rebuiltChanged) {
		return node;
	}

	return node.type.create(node.attrs, Fragment.fromArray(rebuiltChildren), node.marks);
}

export function createMarkdownTaskSupport(
	schema: Schema,
	options: MarkdownTaskSupportOptions = {}
): MarkdownTaskSupport {
	const allowHtml = options.allowHtml === true;

	const md = new MarkdownIt({
		html: allowHtml,
		linkify: true,
		breaks: true
	});

	markdownItTables(md);
	md.enable(['table', 'strikethrough']);

	const tokens = {
		...defaultMarkdownParser.tokens,
		html_inline: { ignore: true },
		html_block: { ignore: true }
	};

	const parser = new MarkdownParser(schema, md, tokens);

	parser.parse = (src: string): PMNode => {
		const preprocessed = preprocessAlignmentHtml(src, allowHtml);

		const html = md.render(preprocessed);
		const container = document.createElement('div');
		container.innerHTML = html;
		const doc = PMDOMParser.fromSchema(schema).parse(container);

		return normalizeAlignmentMarkers(normalizeTasks(doc));
	};

	const baseListItem = defaultMarkdownSerializer.nodes.list_item;
	const baseParagraph = defaultMarkdownSerializer.nodes.paragraph;
	const baseHeading = defaultMarkdownSerializer.nodes.heading;
	const baseBlockquote = defaultMarkdownSerializer.nodes.blockquote;
	const baseTable = defaultMarkdownSerializer.nodes.table;

	const serializerNodes = {
		...defaultMarkdownSerializer.nodes,

		paragraph(
			state: Parameters<NonNullable<typeof baseParagraph>>[0],
			node: Parameters<NonNullable<typeof baseParagraph>>[1],
			parent: Parameters<NonNullable<typeof baseParagraph>>[2],
			index: Parameters<NonNullable<typeof baseParagraph>>[3]
		): void {
			const align = node.attrs.align as AlignValue | null;

			if (!allowHtml || !align || typeof baseParagraph !== 'function') {
				baseParagraph?.(state, node, parent, index);
				return;
			}

			state.write(`<p align="${align}">`);
			state.renderInline(node);
			state.write(`</p>`);
			state.closeBlock(node);
		},

		heading(
			state: Parameters<NonNullable<typeof baseHeading>>[0],
			node: Parameters<NonNullable<typeof baseHeading>>[1],
			parent: Parameters<NonNullable<typeof baseHeading>>[2],
			index: Parameters<NonNullable<typeof baseHeading>>[3]
		): void {
			const align = node.attrs.align as AlignValue | null;

			if (!allowHtml || !align || typeof baseHeading !== 'function') {
				baseHeading?.(state, node, parent, index);
				return;
			}

			const level = Math.max(1, Math.min(6, Number(node.attrs.level) || 1));

			state.write(`<h${level} align="${align}">`);
			state.renderInline(node);
			state.write(`</h${level}>`);
			state.closeBlock(node);
		},

		blockquote(
			state: Parameters<NonNullable<typeof baseBlockquote>>[0],
			node: Parameters<NonNullable<typeof baseBlockquote>>[1],
			parent: Parameters<NonNullable<typeof baseBlockquote>>[2],
			index: Parameters<NonNullable<typeof baseBlockquote>>[3]
		): void {
			const align = node.attrs.align as AlignValue | null;

			if (!allowHtml || !align || typeof baseBlockquote !== 'function') {
				baseBlockquote?.(state, node, parent, index);
				return;
			}

			state.write(`<blockquote align="${align}">`);
			state.renderContent(node);
			state.write(`</blockquote>`);
			state.closeBlock(node);
		},

		list_item(
			state: Parameters<NonNullable<typeof baseListItem>>[0],
			node: Parameters<NonNullable<typeof baseListItem>>[1],
			parent: Parameters<NonNullable<typeof baseListItem>>[2],
			index: Parameters<NonNullable<typeof baseListItem>>[3]
		): void {
			if (typeof baseListItem !== 'function') {
				return;
			}

			const checked = node.attrs.checked;

			if (typeof checked !== 'boolean') {
				baseListItem(state, node, parent, index);
				return;
			}

			const firstChild = node.firstChild;
			if (!isParagraph(firstChild)) {
				baseListItem(state, node, parent, index);
				return;
			}

			const paragraphChildren: PMNode[] = [node.type.schema.text(checked ? '[x] ' : '[ ] ')];

			for (let i = 0; i < firstChild.childCount; i += 1) {
				paragraphChildren.push(firstChild.child(i));
			}

			const patchedParagraph = firstChild.type.create(
				firstChild.attrs,
				Fragment.fromArray(paragraphChildren),
				firstChild.marks
			);

			const patchedChildren: PMNode[] = [patchedParagraph];
			for (let i = 1; i < node.childCount; i += 1) {
				patchedChildren.push(node.child(i));
			}

			const patchedNode = node.type.create(
				{ ...node.attrs, checked: null },
				Fragment.fromArray(patchedChildren),
				node.marks
			);

			baseListItem(state, patchedNode, parent, index);
		},

		table(
			state: Parameters<NonNullable<typeof baseTable>>[0],
			node: Parameters<NonNullable<typeof baseTable>>[1],
			parent: Parameters<NonNullable<typeof baseTable>>[2],
			index: Parameters<NonNullable<typeof baseTable>>[3]
		): void {
			if (node.childCount === 0) {
				baseTable?.(state, node, parent, index);
				return;
			}

			const headerRow = node.firstChild;
			if (!headerRow) {
				baseTable?.(state, node, parent, index);
				return;
			}

			const headerCells = tableRowToCells(headerRow);
			writeTableRow(state, headerCells);
			writeTableRow(
				state,
				headerCells.map((_, index) => tableSeparatorCell(getTableCellAlign(headerRow.child(index))))
			);

			for (let rowIndex = 1; rowIndex < node.childCount; rowIndex += 1) {
				const row = node.child(rowIndex);
				writeTableRow(state, tableRowToCells(row));
			}

			state.closeBlock(node);
		}
	};

	const serializer = new MarkdownSerializer(serializerNodes, defaultMarkdownSerializer.marks);

	return { parser, serializer };
}
