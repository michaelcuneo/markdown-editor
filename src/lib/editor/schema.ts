import { defaultMarkdownParser } from 'prosemirror-markdown';
import { Schema } from 'prosemirror-model';

/**
 * ✅ Extend the default markdown schema with GFM features
 * - task_item
 * - strikethrough
 */
const base = defaultMarkdownParser.schema.spec;

export const markdownSchema = new Schema({
	nodes: base.nodes.append({
		// ✅ Task List Item (GFM)
		task_item: {
			content: 'paragraph block*',
			attrs: { checked: { default: false } },
			group: 'block',
			defining: true,
			parseDOM: [
				{
					tag: 'li[data-task-item]',
					getAttrs: (dom) => ({
						checked: (dom as HTMLElement).getAttribute('data-checked') === 'true'
					})
				}
			],
			toDOM(node) {
				const { checked } = node.attrs;
				return [
					'li',
					{
						'data-task-item': 'true',
						'data-checked': String(checked)
					},
					['input', { type: 'checkbox', checked, disabled: true }],
					['span', 0]
				];
			}
		},

		// ✅ Strike (GitHub-style ~~text~~)
		strike: {
			parseDOM: [{ tag: 's' }, { tag: 'del' }],
			toDOM() {
				return ['s', 0];
			}
		}
	}),

	marks: base.marks.append({
		// Future extension point (highlight, underline, etc.)
	})
});
