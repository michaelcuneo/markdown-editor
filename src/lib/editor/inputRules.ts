import { inputRules, InputRule } from 'prosemirror-inputrules';
import type { Schema } from 'prosemirror-model';

/**
 * Input rules — handle automatic Markdown conversions (e.g. - [x], #, etc.)
 */
export function buildInputRules(schema: Schema) {
	const rules: InputRule[] = [];
	const { nodes } = schema;

	// ✅ Convert "- [ ] " or "- [x] " to task items
	if (nodes.task_item) {
		rules.push(
			new InputRule(/^-\s\[( |x|X)\]\s$/, (state, match, start, end) => {
				const checked = match[1].toLowerCase() === 'x';
				const tr = state.tr.delete(start, end);
				const node = nodes.task_item.create({ checked });
				tr.replaceSelectionWith(node);
				return tr;
			})
		);
	}

	return inputRules({ rules });
}
