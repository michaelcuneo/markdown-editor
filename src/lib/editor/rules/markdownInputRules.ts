import type { Schema, MarkType } from 'prosemirror-model';
import type { Plugin, EditorState, Transaction } from 'prosemirror-state';
import {
	inputRules,
	InputRule,
	wrappingInputRule,
	textblockTypeInputRule
} from 'prosemirror-inputrules';

/**
 * Create an inline-mark input rule for simple Markdown delimiters.
 *
 * This implementation avoids brittle index math by replacing the full matched
 * range with the inner text first, then applying the mark to the inserted text.
 */
function markRule(regexp: RegExp, markType: MarkType): InputRule {
	return new InputRule(
		regexp,
		(
			state: EditorState,
			match: RegExpMatchArray,
			start: number,
			end: number
		): Transaction | null => {
			const text = match[1];
			if (!text) return null;

			const tr = state.tr;

			// Replace the full matched markdown wrapper with only the inner text.
			tr.insertText(text, start, end);

			// Mark the newly inserted text.
			tr.addMark(start, start + text.length, markType.create());

			// Prevent the mark from continuing onto newly typed text.
			tr.removeStoredMark(markType);

			return tr;
		}
	);
}

/**
 * Markdown-compatible input rules for the ProseMirror markdown-style schema.
 */
export function markdownInputRules(schema: Schema): Plugin {
	const rules: InputRule[] = [];

	// --- Inline marks ---
	if (schema.marks.strong) {
		// **bold**
		rules.push(markRule(/\*\*([^*\n]+)\*\*$/, schema.marks.strong));
	}

	if (schema.marks.em) {
		// *italic*
		// Intentionally narrower to reduce collisions with **strong**
		rules.push(markRule(/(?:^|[^*])\*([^*\n]+)\*$/, schema.marks.em));
	}

	if (schema.marks.strikethrough) {
		// ~~strike~~
		rules.push(markRule(/~~([^~\n]+)~~$/, schema.marks.strikethrough));
	}

	if (schema.marks.code) {
		// `inline code`
		rules.push(markRule(/`([^`\n]+)`$/, schema.marks.code));
	}

	// --- Horizontal rule (---, ***, or ___) ---
	if (schema.nodes.horizontal_rule) {
		rules.push(
			new InputRule(/^(?:\*{3,}|-{3,}|_{3,})\s$/, (state, _match, start, end) => {
				const hr = schema.nodes.horizontal_rule;
				if (!hr) return null;

				return state.tr.replaceRangeWith(start, end, hr.create());
			})
		);
	}

	// --- Block rules ---
	if (schema.nodes.heading) {
		// #, ##, ### ...
		rules.push(
			textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (m) => ({
				level: m[1]?.length ?? 1
			}))
		);
	}

	if (schema.nodes.blockquote) {
		// > space
		rules.push(wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote));
	}

	if (schema.nodes.bullet_list && schema.nodes.list_item) {
		// - space, + space, or * space
		rules.push(wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list));
	}

	if (schema.nodes.ordered_list && schema.nodes.list_item) {
		// 1. space
		rules.push(
			wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (m) => ({
				order: Number(m[1] ?? 1)
			}))
		);
	}

	return inputRules({ rules });
}