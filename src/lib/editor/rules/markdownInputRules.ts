import type { Schema, MarkType } from 'prosemirror-model';
import type { Plugin, EditorState, Transaction } from 'prosemirror-state';
import {
	inputRules,
	InputRule,
	wrappingInputRule,
	textblockTypeInputRule
} from 'prosemirror-inputrules';

/**
 * Helper to create an inline mark input rule for Markdown delimiters
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
			const full = match[0];
			const text = match[1];

			// Boundaries for inner text
			const from = start + full.indexOf(text);
			const to = from + text.length;

			const tr = state.tr;
			// Remove delimiters
			tr.delete(to, end);
			tr.delete(start, from);
			// Apply mark to inner text
			tr.addMark(start, start + text.length, markType.create());
			tr.removeStoredMark(markType);
			return tr;
		}
	);
}

/**
 * Markdown-compatible input rules for the prosemirror-markdown schema.
 */
export function markdownInputRules(schema: Schema): Plugin {
	const rules: InputRule[] = [];

	// --- Inline marks ---
	if (schema.marks.strong) {
		// **bold**
		rules.push(markRule(/\*\*([^*]+)\*\*$/, schema.marks.strong));
	}
	if (schema.marks.em) {
		// *italic*
		rules.push(markRule(/\*([^*]+)\*$/, schema.marks.em));
	}
	if ('strikethrough' in schema.marks && schema.marks.strikethrough) {
		// ~~strike~~
		rules.push(markRule(/~~([^~]+)~~$/, schema.marks.strikethrough as MarkType));
	}
	if (schema.marks.code) {
		// `inline code`
		rules.push(markRule(/`([^`]+)`$/, schema.marks.code));
	}
	// --- Horizontal rule (---, ***, or ___)
	if (schema.nodes.horizontal_rule) {
		rules.push(
			new InputRule(
				/^(?:\*{3,}|-{3,}|_{3,})\s*$/, // matches ***, ---, ___, with optional spaces
				(state, _match, start, end) => {
					const tr = state.tr.replaceRangeWith(start, end, schema.nodes.horizontal_rule.create());
					return tr;
				}
			)
		);
	}

	// --- Block rules ---
	if (schema.nodes.heading) {
		// #, ##, ### ...
		rules.push(
			textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (m) => ({
				level: m[1].length
			}))
		);
	}

	if (schema.nodes.blockquote) {
		// > space
		rules.push(wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote));
	}

	if (schema.nodes.bullet_list && schema.nodes.list_item) {
		// - space or * space
		rules.push(wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list));
	}

	if (schema.nodes.ordered_list && schema.nodes.list_item) {
		// 1. space
		rules.push(
			wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (m) => ({
				order: +m[1]
			}))
		);
	}

	return inputRules({ rules });
}
