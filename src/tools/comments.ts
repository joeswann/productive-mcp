import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const addTaskCommentSchema = z.object({
  task_id: z.string().min(1, 'Task ID is required'),
  comment: z.string().min(1, 'Comment text is required'),
});

export async function addTaskCommentTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = addTaskCommentSchema.parse(args);
    
    const commentData = {
      data: {
        type: 'comments' as const,
        attributes: {
          body: params.comment,
        },
        relationships: {
          task: {
            data: {
              id: params.task_id,
              type: 'tasks' as const,
            },
          },
        },
      },
    };
    
    const response = await client.createComment(commentData);
    
    let text = `Comment added successfully!\n`;
    text += `Task ID: ${params.task_id}\n`;
    text += `Comment: ${response.data.attributes.body}\n`;
    text += `Comment ID: ${response.data.id}`;
    if (response.data.attributes.created_at) {
      text += `\nCreated at: ${response.data.attributes.created_at}`;
    }
    
    return {
      content: [{
        type: 'text',
        text: text,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}

const deleteTaskCommentSchema = z.object({
  comment_id: z.string().min(1, 'Comment ID is required'),
});

export async function deleteTaskCommentTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = deleteTaskCommentSchema.parse(args);

    await client.deleteComment(params.comment_id);

    return {
      content: [{
        type: 'text',
        text: `Comment ${params.comment_id} deleted successfully.`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`
      );
    }

    throw new McpError(
      ErrorCode.InternalError,
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}

export const deleteTaskCommentDefinition = {
  name: 'delete_task_comment',
  description: 'Delete a comment from a task in Productive.io',
  inputSchema: {
    type: 'object',
    properties: {
      comment_id: {
        type: 'string',
        description: 'ID of the comment to delete (required)',
      },
    },
    required: ['comment_id'],
  },
};

// --- List Comments ---

const listCommentsSchema = z.object({
  task_id: z.string().optional().describe('Filter comments by task ID'),
  project_id: z.string().optional().describe('Filter comments by project ID'),
  limit: z.number().min(1).max(200).default(30).optional(),
  page: z.number().int().min(1).optional(),
});

export async function listCommentsTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listCommentsSchema.parse(args || {});

    if (!params.task_id && !params.project_id) {
      throw new McpError(ErrorCode.InvalidParams, 'At least one of task_id or project_id is required');
    }

    const response = await client.listComments({
      task_id: params.task_id,
      project_id: params.project_id,
      limit: params.limit,
      page: params.page,
    });

    if (!response.data || response.data.length === 0) {
      return {
        content: [{ type: 'text', text: 'No comments found.' }],
      };
    }

    // Build lookup map from included resources (creator names)
    const includedMap = new Map<string, Record<string, unknown>>();
    if (response.included) {
      for (const item of response.included) {
        includedMap.set(`${item.type}:${item.id}`, item.attributes);
      }
    }

    const commentsText = response.data.map(comment => {
      const creatorId = comment.relationships?.creator?.data?.id;
      const creatorAttrs = creatorId ? includedMap.get(`people:${creatorId}`) : undefined;
      const creatorName = creatorAttrs ? `${creatorAttrs.first_name} ${creatorAttrs.last_name}`.trim() : undefined;

      const body = comment.attributes.body || '(empty)';
      const created = comment.attributes.created_at ? new Date(comment.attributes.created_at).toLocaleString() : '';

      return `• Comment ${comment.id}${created ? ` (${created})` : ''}
  By: ${creatorName || (creatorId ? `Person ID ${creatorId}` : 'Unknown')}
  ${body}`;
    }).join('\n\n');

    const total = response.meta?.total_count;
    const summary = `Found ${response.data.length} comment${response.data.length !== 1 ? 's' : ''}${total ? ` (showing ${response.data.length} of ${total})` : ''}:\n\n${commentsText}`;

    return {
      content: [{ type: 'text', text: summary }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const listCommentsDefinition = {
  name: 'list_comments',
  description: 'List comments on a task or project in Productive.io. Shows comment text, author, and timestamps. At least one of task_id or project_id is required.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'Filter comments by task ID' },
      project_id: { type: 'string', description: 'Filter comments by project ID' },
      limit: { type: 'number', description: 'Max results (1-200)', minimum: 1, maximum: 200, default: 30 },
      page: { type: 'number', description: 'Page number', minimum: 1 },
    },
  },
};

export const addTaskCommentDefinition = {
  name: 'add_task_comment',
  description: 'Add a comment to a task in Productive.io',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'ID of the task to add the comment to (required)',
      },
      comment: {
        type: 'string',
        description: 'Text content of the comment (required)',
      },
    },
    required: ['task_id', 'comment'],
  },
};