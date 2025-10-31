// src/lib/editor/markdownBridge.ts
import MarkdownIt from 'markdown-it';
import markdownItTaskLists from 'markdown-it-task-lists';
import markdownItDeflist from 'markdown-it-deflist';
import markdownItSub from 'markdown-it-sub';
import markdownItSup from 'markdown-it-sup';
import markdownItFootnote from 'markdown-it-footnote';
import {
	MarkdownParser,
	MarkdownSerializer,
	defaultMarkdownParser,
	defaultMarkdownSerializer
} from 'prosemirror-markdown';
import type { Node as ProseNode } from 'prosemirror-model';
import { markdownSchema } from './schema.js';

/* ============================================================
   🌐 SSR-SAFE INITIALIZATION
   ============================================================ */

const isBrowser = typeof window !== 'undefined';

// 🧩 Configure Markdown-it (GFM style)
const md = new MarkdownIt({
	html: false,
	linkify: true,
	typographer: true
})
	.use(markdownItTaskLists, { label: true, enabled: true })
	.use(markdownItDeflist)
	.use(markdownItSub)
	.use(markdownItSup)
	.use(markdownItFootnote);

// 🧱 Default safe token handlers (filter undefined)
const safeDefaultTokens = Object.fromEntries(
	Object.entries(defaultMarkdownParser.tokens).filter(
		([, handler]) => typeof handler !== 'undefined'
	)
);

// Extend the handlers only if in the browser
const tokenHandlers = isBrowser
	? {
			...safeDefaultTokens,

			heading_open: (state, token) => {
				const level = Number(token.tag.slice(1));
				if (!markdownSchema.nodes.heading) return;
				state.openNode(markdownSchema.nodes.heading, { level });
			},
			heading_close: (state) => state.closeNode(),

			list_item_open: (state, token) => {
				const isTask =
					token.attrGet('data-task-item') || token.attrGet('class')?.includes('task-list-item');
				const listNode =
					isTask && markdownSchema.nodes.task_item
						? markdownSchema.nodes.task_item
						: markdownSchema.nodes.list_item;

				const checked =
					token.attrGet('data-checked') === 'true' || token.attrGet('class')?.includes('checked');
				state.openNode(listNode, isTask ? { checked } : {});
			},
			list_item_close: (state) => state.closeNode()
		}
	: safeDefaultTokens;

/* ============================================================
   🧱 Parser + Serializer (browser-safe construction)
   ============================================================ */

let markdownParser: MarkdownParser;
try {
	markdownParser = isBrowser
		? new MarkdownParser(markdownSchema, md, tokenHandlers)
		: defaultMarkdownParser;
} catch (err) {
	console.warn('⚠️ Falling back to default parser (SSR-safe)', err);
	markdownParser = defaultMarkdownParser;
}

const markdownSerializer = new MarkdownSerializer(
	{
		...defaultMarkdownSerializer.nodes,
		task_item(state, node) {
			const checked = node.attrs.checked ? 'x' : ' ';
			state.write(`- [${checked}] `);
			state.renderContent(node);
			state.closeBlock(node);
		}
	},
	defaultMarkdownSerializer.marks
);

/* ============================================================
   🔄 Safe helper functions
   ============================================================ */

export function markdownToProseMirror(markdown: string): ProseNode {
	try {
		return markdownParser.parse(markdown);
	} catch (err) {
		console.error('❌ Markdown → ProseMirror parse error:', err);
		return markdownSchema.node('doc', null, [markdownSchema.node('paragraph')]);
	}
}

export function proseMirrorToMarkdown(doc: ProseNode): string {
	try {
		return markdownSerializer.serialize(doc);
	} catch (err) {
		console.error('❌ ProseMirror → Markdown serialization error:', err);
		return '';
	}
}

export function initLiveParser() {
	// Keep ALL defined handlers (functions OR objects)
	const safeTokens = Object.fromEntries(
		Object.entries(defaultMarkdownParser.tokens).filter(
			([, handler]) => handler !== undefined && handler !== null
		)
	);

	const liveParser = new MarkdownParser(markdownSchema, md, safeTokens);

	return {
		parser: liveParser,
		parse: (markdown: string) => liveParser.parse(markdown)
	};
}

/* ============================================================
   🌉 Unified Bridge
   ============================================================ */

export const MarkdownBridge = {
	parse: markdownToProseMirror,
	serialize: proseMirrorToMarkdown,
	parser: markdownParser,
	serializer: markdownSerializer
};
