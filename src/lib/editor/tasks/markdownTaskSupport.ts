import {
	MarkdownParser,
	MarkdownSerializer,
	defaultMarkdownParser,
	defaultMarkdownSerializer
} from 'prosemirror-markdown';
import type { Schema, Node as PMNode } from 'prosemirror-model';
import { Fragment } from 'prosemirror-model';
import MarkdownIt from 'markdown-it';

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

/**
 * Recursively normalize GFM-style task lists like `- [x]` or `- [ ]`
 * into list_item nodes with a `checked` attr.
 */
function normalizeTasks(node: PMNode): PMNode {
	if (node.isText) return node;

	const normalizedChildren: PMNode[] = [];
	let childChanged = false;

	node.forEach((child: PMNode) => {
		const normalized = normalizeTasks(child);
		if (normalized !== child) childChanged = true;
		normalizedChildren.push(normalized);
	});

	const normalizedContent = childChanged
		? Fragment.fromArray(normalizedChildren)
		: node.content;

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

type MarkdownTaskSupport = {
	parser: MarkdownParser;
	serializer: MarkdownSerializer;
};

/**
 * Create Markdown parser + serializer with GFM-style task list support.
 */
export function createMarkdownTaskSupport(schema: Schema): MarkdownTaskSupport {
	const md = new MarkdownIt('commonmark', {
		html: false,
		linkify: true,
		breaks: true
	});

	const tokens = {
		...defaultMarkdownParser.tokens,
		html_inline: { ignore: true },
		html_block: { ignore: true }
	};

	const parser = new MarkdownParser(schema, md, tokens);
	const parseBase = parser.parse.bind(parser);

	parser.parse = (src: string): PMNode => {
		const doc = parseBase(src);
		return normalizeTasks(doc);
	};

	const baseListItem = defaultMarkdownSerializer.nodes.list_item;

	const serializerNodes = {
		...defaultMarkdownSerializer.nodes,

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

			const paragraphChildren: PMNode[] = [
				node.type.schema.text(checked ? '[x] ' : '[ ] ')
			];

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
		}
	};

	const serializer = new MarkdownSerializer(
		serializerNodes,
		defaultMarkdownSerializer.marks
	);

	return { parser, serializer };
}