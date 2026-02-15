import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { Config } from '../config/index.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const myTasksSchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
  closed_after: z.string().optional(),
  closed_before: z.string().optional(),
  last_activity_after: z.string().optional(),
  last_activity_before: z.string().optional(),
  sort: z.string().optional(),
  limit: z.number().min(1).max(200).default(30).optional(),
});

export async function myTasksTool(
  client: ProductiveAPIClient,
  config: Config,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Check if user ID is configured
    if (!config.PRODUCTIVE_USER_ID) {
      return {
        content: [{
          type: 'text',
          text: 'User ID not configured. Please set PRODUCTIVE_USER_ID in your environment variables to use this feature.',
        }],
      };
    }
    
    const params = myTasksSchema.parse(args || {});
    
    const response = await client.listTasks({
      assignee_id: config.PRODUCTIVE_USER_ID,
      status: params.status,
      closed_after: params.closed_after,
      closed_before: params.closed_before,
      last_activity_after: params.last_activity_after,
      last_activity_before: params.last_activity_before,
      sort: params.sort,
      limit: params.limit,
    });

    if (!response || !response.data || response.data.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'You have no tasks assigned to you.',
        }],
      };
    }

    // Build lookup maps from included relationships
    const included = response.included || [];
    const projectMap = new Map<string, string>();
    for (const inc of included) {
      if (inc.type === 'projects') projectMap.set(inc.id, String(inc.attributes?.name || ''));
    }

    const tasksText = response.data.filter(task => task && task.attributes).map(task => {
      const projectId = task.relationships?.project?.data?.id;
      const projectName = projectId ? projectMap.get(projectId) : undefined;
      const statusIcon = task.attributes.status === 2 ? '✓' : '○';

      let line = `${statusIcon} ${task.attributes.title} (ID: ${task.id})`;
      if (projectName) {
        line += `\n  Project: ${projectName}`;
      } else if (projectId) {
        line += `\n  Project ID: ${projectId}`;
      }
      if (task.attributes.due_date) line += `\n  Due: ${task.attributes.due_date}`;
      if (task.attributes.closed_at) line += `\n  Closed: ${task.attributes.closed_at}`;
      if (task.attributes.last_activity_at) line += `\n  Last Activity: ${task.attributes.last_activity_at}`;
      return line;
    }).join('\n\n');
    
    const summary = `You have ${response.data.length} task${response.data.length !== 1 ? 's' : ''} assigned to you${response.meta?.total_count ? ` (showing ${response.data.length} of ${response.meta.total_count})` : ''}:\n\n${tasksText}`;
    
    return {
      content: [{
        type: 'text',
        text: summary,
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

export const myTasksDefinition = {
  name: 'my_tasks',
  description: 'Get tasks assigned to you (requires PRODUCTIVE_USER_ID to be configured). Supports date-range filters and sorting.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['open', 'closed'],
        description: 'Filter by task status (open or closed)',
      },
      closed_after: {
        type: 'string',
        description: 'Filter tasks closed after this date (YYYY-MM-DD)',
      },
      closed_before: {
        type: 'string',
        description: 'Filter tasks closed before this date (YYYY-MM-DD)',
      },
      last_activity_after: {
        type: 'string',
        description: 'Filter tasks with last activity after this date (YYYY-MM-DD)',
      },
      last_activity_before: {
        type: 'string',
        description: 'Filter tasks with last activity before this date (YYYY-MM-DD)',
      },
      sort: {
        type: 'string',
        description: 'Sort field. Prefix with - for descending. Options: created_at, updated_at, closed_at, last_activity_at, due_date, title, worked_time, project_name. Example: -last_activity_at',
      },
      limit: {
        type: 'number',
        description: 'Number of tasks to return (1-200)',
        minimum: 1,
        maximum: 200,
        default: 30,
      },
    },
  },
};
