// src/lib/editor/theme/codeMirrorTheme.ts
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/* -----------------------------------------------------------------------
   🩵 Light Theme (GitHub-inspired, matches your md-* tokens)
   ----------------------------------------------------------------------- */
export const codeMirrorLight = EditorView.theme(
	{
		'&': {
			color: 'var(--md-code-fg, #0056b3)',
			backgroundColor: 'var(--md-code-bg, #f5f5f5)',
			borderRadius: '6px',
			border: '1px solid var(--md-border, #e0e0e0)',
			fontFamily: 'JetBrains Mono, monospace',
			fontSize: '0.9rem'
		},
		'.cm-content': { padding: '0.75rem' },
		'.cm-line': { lineHeight: '1.5' },
		'.cm-selectionBackground, .cm-selectionMatch': {
			backgroundColor: 'var(--md-selection-bg, #cce0ff)'
		},
		'&.cm-focused': {
			outline: '1px solid var(--md-accent, #4f83ff)',
			outlineOffset: '1px'
		},
		'.cm-gutters': {
			backgroundColor: 'var(--md-code-bg, #f5f5f5)',
			borderRight: '1px solid var(--md-border, #e0e0e0)',
			color: 'var(--md-muted, #999)'
		}
	},
	{ dark: false }
);

/* -----------------------------------------------------------------------
   🌑 True One Dark Theme (based on @codemirror/theme-one-dark)
   ----------------------------------------------------------------------- */
export const codeMirrorDark = EditorView.theme(
	{
		'&': {
			color: '#abb2bf', // ivory
			backgroundColor: '#282c34', // background
			borderRadius: '6px',
			border: '1px solid var(--md-border, #2c2d30)',
			fontFamily: 'JetBrains Mono, monospace',
			fontSize: '0.9rem'
		},
		'.cm-content': {
			caretColor: '#528bff'
		},
		'.cm-cursor, .cm-dropCursor': {
			borderLeftColor: '#528bff'
		},
		'.cm-selectionBackground, .cm-selectionMatch, .cm-content ::selection': {
			backgroundColor: '#3e4451'
		},
		'.cm-panels': {
			backgroundColor: '#21252b',
			color: '#abb2bf'
		},
		'.cm-activeLine': {
			backgroundColor: '#2c313a'
		},
		'.cm-gutters': {
			backgroundColor: '#282c34',
			color: '#7d8799',
			border: 'none'
		},
		'.cm-activeLineGutter': {
			backgroundColor: '#2c313a'
		},
		'.cm-tooltip': {
			border: 'none',
			backgroundColor: '#353a42',
			color: '#abb2bf'
		},
		'.cm-tooltip-autocomplete > ul > li[aria-selected]': {
			backgroundColor: '#2c313a',
			color: '#abb2bf'
		},
		'&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
			backgroundColor: '#bad0f847'
		}
	},
	{ dark: true }
);

/* -----------------------------------------------------------------------
   ✨ Syntax Highlighting Rules (One Dark palette)
   ----------------------------------------------------------------------- */
export const codeMirrorHighlight = HighlightStyle.define([
	{ tag: tags.keyword, color: '#c678dd' }, // violet
	{
		tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName],
		color: '#e06c75' // coral
	},
	{
		tag: [tags.function(tags.variableName), tags.labelName],
		color: '#61afef' // malibu
	},
	{
		tag: [
			tags.color,
			tags.constant(tags.name),
			tags.standard(tags.name),
			tags.definition(tags.name),
			tags.separator
		],
		color: '#abb2bf' // ivory
	},
	{
		tag: [
			tags.typeName,
			tags.className,
			tags.number,
			tags.changed,
			tags.annotation,
			tags.modifier,
			tags.self,
			tags.namespace
		],
		color: '#e5c07b' // chalky
	},
	{
		tag: [
			tags.operator,
			tags.operatorKeyword,
			tags.url,
			tags.escape,
			tags.regexp,
			tags.link,
			tags.special(tags.string)
		],
		color: '#56b6c2' // cyan
	},
	{ tag: [tags.meta, tags.comment], color: '#7d8799', fontStyle: 'italic' }, // stone
	{ tag: tags.strong, fontWeight: 'bold' },
	{ tag: tags.emphasis, fontStyle: 'italic' },
	{ tag: tags.strikethrough, textDecoration: 'line-through' },
	{ tag: tags.link, color: '#61afef', textDecoration: 'underline' },
	{ tag: tags.heading, fontWeight: 'bold', color: '#e06c75' },
	{ tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: '#d19a66' }, // whiskey
	{ tag: [tags.processingInstruction, tags.string, tags.inserted], color: '#98c379' }, // sage
	{ tag: tags.invalid, color: '#ffffff' }
]);

/* -----------------------------------------------------------------------
   🧩 Combined Theme Extension
   ----------------------------------------------------------------------- */
export const codeMirrorTheme = [
	codeMirrorLight,
	codeMirrorDark,
	syntaxHighlighting(codeMirrorHighlight)
];
