import {
	MarkdownParser,
	MarkdownSerializer,
	defaultMarkdownParser,
	defaultMarkdownSerializer
} from 'prosemirror-markdown';
import type { Schema, Node as PMNode } from 'prosemirror-model';
import { Fragment } from 'prosemirror-model';
import MarkdownIt from 'markdown-it';

/**
 * Recursively normalize GFM-style task lists like `- [x]` or `- [ ]`.
 */
function normalizeTasks(node: PMNode): PMNode {
	if (node.isText) return node;

	const normalizedChildren: PMNode[] = [];
	node.forEach((child) => normalizedChildren.push(child.isText ? child : normalizeTasks(child)));
	const content = Fragment.fromArray(normalizedChildren);

	if (node.type.name !== 'list_item') return node.copy(content);

	const firstChild = node.firstChild;
	if (!firstChild || firstChild.type.name !== 'paragraph') return node.copy(content);

	const firstInline = firstChild.firstChild;
	if (!firstInline || !firstInline.isText) return node.copy(content);

	const text = firstInline.text ?? '';
	const match = text.match(/^\s*\[( |x|X)\]\s+/);
	if (!match) return node.copy(content);

	const isChecked = match[1].toLowerCase() === 'x';
	const trimmedText = text.slice(match[0].length);

	const newInlineNodes: PMNode[] = [];
	if (trimmedText.length > 0)
		newInlineNodes.push(node.type.schema.text(trimmedText, firstInline.marks));
	for (let i = 1; i < firstChild.childCount; i++) newInlineNodes.push(firstChild.child(i));

	const newParagraph = firstChild.type.create(firstChild.attrs, Fragment.fromArray(newInlineNodes));
	const rebuiltChildren = [newParagraph, ...node.content.content.slice(1)];

	return node.type.create(
		{ ...node.attrs, checked: isChecked },
		Fragment.fromArray(rebuiltChildren),
		node.marks
	);
}

/**
 * Create Markdown parser + serializer using default ProseMirror GFM behavior.
 */
export function createMarkdownTaskSupport(schema: Schema) {
	// ✅ Use the "gfm" preset — enables autolinks, strikethrough, breaks, etc.
	const md = MarkdownIt('commonmark', { html: false, linkify: true, breaks: true });

	// ✅ Start from the built-in token map
	const tokens = {
		...defaultMarkdownParser.tokens,
		html_inline: { ignore: true },
		html_block: { ignore: true }
	};

	// --- Build parser
	const parser = new MarkdownParser(schema, md, tokens);
	const origParse = parser.parse.bind(parser);
	parser.parse = (src: string) => normalizeTasks(origParse(src));

	// --- Build serializer
	const serializer = new MarkdownSerializer(
		{
			...defaultMarkdownSerializer.nodes,
			list_item(state, node) {
				const checked = node.attrs.checked;
				if (checked === true) state.write('[x] ');
				else if (checked === false) state.write('[ ] ');
				state.renderContent(node);
			}
		},
		defaultMarkdownSerializer.marks
	);

	return { parser, serializer };
}
