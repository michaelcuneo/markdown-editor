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

	const content: PMNode[] = [];
	let changed = false;

	node.forEach((child) => {
		const normalized = normalizeTasks(child);
		if (normalized !== child) changed = true;
		content.push(normalized);
	});

	const newContent: Fragment = changed ? Fragment.fromArray(content) : node.content;

	if (node.type.name !== 'list_item') {
		return changed ? node.copy(newContent) : node;
	}

	const firstChild = node.firstChild;
	if (!firstChild || firstChild.type.name !== 'paragraph') {
		return changed ? node.copy(newContent) : node;
	}

	const firstInline = firstChild.firstChild;
	if (!firstInline || !firstInline.isText) {
		return changed ? node.copy(newContent) : node;
	}

	const text = firstInline.text ?? '';
	const match = text.match(/^\s*\[( |x|X)\]\s+/);
	if (!match) return changed ? node.copy(newContent) : node;

	const isChecked = (match[1] ?? '').toLowerCase() === 'x';
	const trimmedText = text.slice(match[0].length);

	// ✅ Preserve marks and rebuild only this paragraph node
	const newInlines: PMNode[] = [];
	if (trimmedText.length > 0) {
		newInlines.push(node.type.schema.text(trimmedText, firstInline.marks));
	}
	for (let i = 1; i < firstChild.childCount; i++) {
		newInlines.push(firstChild.child(i));
	}

	const newParagraph =
		trimmedText.length > 0 || firstChild.childCount > 1
			? firstChild.type.create(firstChild.attrs, Fragment.fromArray(newInlines))
			: firstChild;

	const rebuiltChildren = [newParagraph, ...node.content.content.slice(1)];
	const rebuiltContent = Fragment.fromArray(rebuiltChildren);

	// ✅ Only rebuild the node if the 'checked' state actually differs
	if (node.attrs.checked !== isChecked || changed) {
		return node.type.create({ ...node.attrs, checked: isChecked }, rebuiltContent, node.marks);
	}

	return node.copy(rebuiltContent);
}

/**
 * Create Markdown parser + serializer with GFM-style tasks.
 */
export function createMarkdownTaskSupport(schema: Schema) {
	const md = MarkdownIt('commonmark', { html: false, linkify: true, breaks: true });

	const tokens = {
		...defaultMarkdownParser.tokens,
		html_inline: { ignore: true },
		html_block: { ignore: true }
	};

	const parser = new MarkdownParser(schema, md, tokens);
	const origParse = parser.parse.bind(parser);
	parser.parse = (src: string) => {
		const doc = origParse(src);
		return normalizeTasks(doc);
	};

	const serializer = new MarkdownSerializer(
		{
			...defaultMarkdownSerializer.nodes,
			list_item(state, node) {
				const checked = node.attrs.checked;
				if (typeof checked === 'boolean') {
					state.write(checked ? '[x] ' : '[ ] ');
				}
				state.renderContent(node);
			}
		},
		defaultMarkdownSerializer.marks
	);

	return { parser, serializer };
}
