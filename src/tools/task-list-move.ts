import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const moveTaskToListSchema = z.object({
  task_id: z.string().describe('ID of the task to move'),
  task_list_id: z.string().describe('ID of the task list to move the task to'),
  project_id: z.string().optional().describe('Target project ID (required for cross-project moves)'),
});

export async function moveTaskToList(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { task_id, task_list_id, project_id } = moveTaskToListSchema.parse(args);

    const relationships: Record<string, { data: { type: string; id: string } }> = {
      task_list: {
        data: {
          type: 'task_lists',
          id: task_list_id
        }
      }
    };

    if (project_id) {
      relationships.project = {
        data: {
          type: 'projects',
          id: project_id
        }
      };
    }

    const response = await client.updateTask(task_id, {
      data: {
        type: 'tasks',
        id: task_id,
        relationships,
      }
    });

    const suffix = project_id ? ` in project ${project_id}` : '';
    return {
      content: [{
        type: 'text',
        text: `Moved task ${task_id} to task list ${task_list_id}${suffix}`
      }]
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`
      );
    }
    throw error;
  }
}

export const moveTaskToListTool = {
  name: 'move_task_to_list',
  description: 'Move a task to a different task list. Supports cross-project moves when project_id is provided.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'ID of the task to move'
      },
      task_list_id: {
        type: 'string',
        description: 'ID of the target task list'
      },
      project_id: {
        type: 'string',
        description: 'Target project ID (required for cross-project moves)'
      }
    },
    required: ['task_id', 'task_list_id']
  }
};
