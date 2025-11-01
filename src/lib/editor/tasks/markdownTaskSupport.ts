import {
	MarkdownParser,
	MarkdownSerializer,
	defaultMarkdownParser,
	defaultMarkdownSerializer
} from 'prosemirror-markdown';
import type { Schema, Node as PMNode } from 'prosemirror-model';
import { Fragment } from 'prosemirror-model';
import MarkdownIt from 'markdown-it';

function normalizeTasks(node: PMNode): PMNode {
	// 🧩 Text nodes are leaves — return directly
	if (node.isText) return node;

	// 🧩 Normalize all children recursively
	const normalizedChildren: PMNode[] = [];
	node.forEach((child) => {
		normalizedChildren.push(child.isText ? child : normalizeTasks(child));
	});
	const content = Fragment.fromArray(normalizedChildren);

	// 🧩 Only transform list_item nodes
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

	// 🧩 Build new inline nodes
	const newInlineNodes: PMNode[] = [];
	if (trimmedText.length > 0) {
		// ✅ Use schema.text() — not .create()
		const newText = node.type.schema.text(trimmedText, firstInline.marks);
		newInlineNodes.push(newText);
	}

	// Add any remaining inline nodes
	for (let i = 1; i < firstChild.childCount; i++) {
		newInlineNodes.push(firstChild.child(i));
	}

	const newParagraph = firstChild.type.create(
		firstChild.attrs,
		Fragment.fromArray(newInlineNodes),
		firstChild.marks
	);

	// 🧩 Build final list_item
	const rebuiltChildren: PMNode[] = [newParagraph];
	for (let i = 1; i < node.childCount; i++) {
		rebuiltChildren.push(node.child(i));
	}

	return node.type.create(
		{ ...node.attrs, checked: isChecked },
		Fragment.fromArray(rebuiltChildren),
		node.marks
	);
}

/**
 * Proper GFM task-list aware parser + serializer pair.
 */
export function createMarkdownTaskSupport(schema: Schema) {
	const md = MarkdownIt('commonmark', { html: false, linkify: true });
	const tokens = { ...(defaultMarkdownParser as MarkdownParser).tokens };
	tokens.html_inline = { ignore: true };
	tokens.html_block = { ignore: true };

	const parser = new MarkdownParser(schema, md, tokens);
	const origParse = parser.parse.bind(parser);

	parser.parse = (src: string) => {
		const baseDoc = origParse(src);
		console.log(
			'%c🔍 Parsed document JSON:',
			'color:#4f83ff;font-weight:bold;',
			JSON.stringify(baseDoc.toJSON(), null, 2)
		);
		const normalized = normalizeTasks(baseDoc);
		console.log(
			'%c🔍 Normalized document JSON:',
			'color:#00bfff;font-weight:bold;',
			JSON.stringify(normalized.toJSON(), null, 2)
		);
		return normalized;
	};

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
