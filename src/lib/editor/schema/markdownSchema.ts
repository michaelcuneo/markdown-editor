import type { Schema } from 'prosemirror-model';
import { createTaskListSchema } from './tasklistSchema.js';

/**
 * Create the unified Markdown schema.
 */
export function createMarkdownSchema(): Schema {
	return createTaskListSchema();
}
