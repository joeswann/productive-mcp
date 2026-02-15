import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ProductiveAPIClient } from '../api/client.js';

const ListActivitiesRequestSchema = z.object({
  task_id: z.string().optional(),
  project_id: z.string().optional(),
  person_id: z.string().optional(),
  creator_id: z.string().optional(),
  company_id: z.string().optional(),
  item_type: z.string().optional(),
  event: z.string().optional(),
  after: z.string().optional(), // ISO 8601 date string
  before: z.string().optional(), // ISO 8601 date string
  days_back: z.number().min(1).max(365).optional(), // Helper for "last N days"
  limit: z.number().min(1).max(200).optional(),
  page: z.number().min(1).optional(),
});

export async function listActivities(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = ListActivitiesRequestSchema.parse(args);
    
    // Helper: Convert days_back to 'after' parameter
    let after = params.after;
    if (params.days_back && !after) {
      const date = new Date();
      date.setDate(date.getDate() - params.days_back);
      after = date.toISOString();
    }
    
    const response = await client.listActivities({
      task_id: params.task_id,
      project_id: params.project_id,
      person_id: params.person_id,
      creator_id: params.creator_id,
      company_id: params.company_id,
      item_type: params.item_type,
      event: params.event,
      after,
      before: params.before,
      limit: params.limit,
      page: params.page,
    });

    // Build lookup map for creator names from included data
    const included = response.included || [];
    const peopleMap = new Map<string, string>();
    for (const inc of included) {
      if (inc.type === 'people') {
        peopleMap.set(inc.id, `${inc.attributes?.first_name || ''} ${inc.attributes?.last_name || ''}`.trim());
      }
    }

    const activities = response.data;
    let output = `Found ${activities.length} activities`;

    if (response.meta?.total_count) {
      output += ` (${response.meta.total_count} total)`;
    }

    if (params.days_back) {
      output += ` from the last ${params.days_back} days`;
    } else if (after || params.before) {
      output += ` within specified date range`;
    }

    output += ':\n\n';

    if (activities.length === 0) {
      output += 'No activities found for the specified criteria.';
    } else {
      for (const activity of activities) {
        const createdAt = new Date(activity.attributes.created_at).toLocaleString();
        const event = activity.attributes.event;
        const itemType = activity.attributes.item_type;
        const itemId = activity.attributes.item_id;

        output += `• ${createdAt} - ${event} ${itemType} (ID: ${itemId})`;

        if (activity.attributes.changes && Object.keys(activity.attributes.changes).length > 0) {
          const changes = Object.entries(activity.attributes.changes)
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join(', ');
          output += `\n  Changes: ${changes}`;
        }

        const creatorId = activity.relationships?.creator?.data?.id;
        if (creatorId) {
          const creatorName = peopleMap.get(creatorId);
          output += `\n  Creator: ${creatorName || `Person ID ${creatorId}`}`;
        }

        output += '\n\n';
      }
    }

    if (response.links?.next) {
      output += '\nUse page parameter to get more results.';
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to list activities: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export const listActivitiesTool = {
  name: 'list_activities',
  description: 'List activities (changes/updates) from Productive.io with filtering options for tracking recent work. Includes creator names. Use creator_id to filter by who made the change, person_id to filter by who is involved.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'Filter activities for a specific task ID',
      },
      project_id: {
        type: 'string',
        description: 'Filter activities for a specific project ID',
      },
      person_id: {
        type: 'string',
        description: 'Filter activities involving a specific person/user ID',
      },
      creator_id: {
        type: 'string',
        description: 'Filter activities created by a specific person ID',
      },
      company_id: {
        type: 'string',
        description: 'Filter activities for a specific company ID',
      },
      item_type: {
        type: 'string',
        description: 'Filter by item type (e.g., "Task", "Project", "Workspace")',
      },
      event: {
        type: 'string',
        description: 'Filter by event type (e.g., "create", "update", "delete")',
      },
      after: {
        type: 'string',
        description: 'Filter activities after this date (ISO 8601 format, e.g., "2024-01-01T00:00:00Z")',
      },
      before: {
        type: 'string',
        description: 'Filter activities before this date (ISO 8601 format)',
      },
      days_back: {
        type: 'number',
        description: 'Filter activities from the last N days (1-365). Alternative to using "after"',
        minimum: 1,
        maximum: 365,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of activities to return (1-200, default: 30)',
        minimum: 1,
        maximum: 200,
      },
      page: {
        type: 'number',
        description: 'Page number for pagination (starts from 1)',
        minimum: 1,
      },
    },
    additionalProperties: false,
  },
};