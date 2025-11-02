import { Schema } from 'prosemirror-model';
import { createTaskListSchema } from './tasklistSchema.js';

/**
 * Merge tasklist + tables into a unified Markdown schema.
 */
export function createMarkdownSchema(): Schema {
	const taskSchema = createTaskListSchema();

	return new Schema({
		nodes: taskSchema.spec.nodes,
		marks: taskSchema.spec.marks
	});
}
