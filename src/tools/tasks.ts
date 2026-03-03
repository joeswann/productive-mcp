import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ProductiveTaskUpdate } from '../api/types.js';

const listTasksSchema = z.object({
  project_id: z.string().optional(),
  assignee_id: z.string().optional(),
  status: z.enum(['open', 'closed']).optional(),
  query: z.string().optional(),
  due_date_after: z.string().optional(),
  due_date_before: z.string().optional(),
  task_list_id: z.string().optional(),
  board_id: z.string().optional(),
  company_id: z.string().optional(),
  closed_after: z.string().optional(),
  closed_before: z.string().optional(),
  last_activity_after: z.string().optional(),
  last_activity_before: z.string().optional(),
  sort: z.string().optional(),
  limit: z.number().min(1).max(200).default(30).optional(),
});

const getProjectTasksSchema = z.object({
  project_id: z.string().min(1, 'Project ID is required'),
  status: z.enum(['open', 'closed']).optional(),
});

const getTaskSchema = z.object({
  task_id: z.string().min(1, 'Task ID is required'),
});

export async function listTasksTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listTasksSchema.parse(args || {});
    
    const response = await client.listTasks({
      project_id: params.project_id,
      assignee_id: params.assignee_id,
      status: params.status,
      query: params.query,
      due_date_after: params.due_date_after,
      due_date_before: params.due_date_before,
      task_list_id: params.task_list_id,
      board_id: params.board_id,
      company_id: params.company_id,
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
          text: 'No tasks found matching the criteria.',
        }],
      };
    }

    // Build lookup maps from included relationships
    const included = response.included || [];
    const peopleMap = new Map<string, string>();
    const statusMap = new Map<string, string>();
    const projectMap = new Map<string, string>();
    for (const inc of included) {
      if (inc.type === 'people') peopleMap.set(inc.id, `${inc.attributes?.first_name || ''} ${inc.attributes?.last_name || ''}`.trim());
      if (inc.type === 'workflow_statuses') statusMap.set(inc.id, String(inc.attributes?.name || ''));
      if (inc.type === 'projects') projectMap.set(inc.id, String(inc.attributes?.name || ''));
    }

    const tasksText = response.data.filter(task => task && task.attributes).map(task => {
      const projectId = task.relationships?.project?.data?.id;
      const projectName = projectId ? projectMap.get(projectId) : undefined;
      const assigneeData = task.relationships?.assignee?.data;
      let assigneeText = 'Unassigned';
      if (assigneeData) {
        assigneeText = peopleMap.get(assigneeData.id) || `ID:${assigneeData.id}`;
      }
      const wsId = task.relationships?.workflow_status?.data?.id;
      const statusText = wsId && statusMap.get(wsId) ? statusMap.get(wsId) : (task.attributes.status === 1 ? 'open' : task.attributes.status === 2 ? 'closed' : `status ${task.attributes.status}`);

      let line = `• ${task.attributes.title} (ID: ${task.id})
  Status: ${statusText} | Assignee: ${assigneeText}`;
      if (projectName) {
        line += `\n  Project: ${projectName} (ID: ${projectId})`;
      } else if (projectId) {
        line += `\n  Project ID: ${projectId}`;
      }
      if (task.attributes.due_date) line += `\n  Due: ${task.attributes.due_date}`;
      if (task.attributes.closed_at) line += `\n  Closed: ${task.attributes.closed_at}`;
      if (task.attributes.last_activity_at) line += `\n  Last Activity: ${task.attributes.last_activity_at}`;
      if (task.attributes.worked_time) line += `\n  Tracked: ${(task.attributes.worked_time / 60).toFixed(1)}h`;
      return line;
    }).join('\n\n');
    
    const summary = `Found ${response.data.length} task${response.data.length !== 1 ? 's' : ''}${response.meta?.total_count ? ` (showing ${response.data.length} of ${response.meta.total_count})` : ''}:\n\n${tasksText}`;
    
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

export async function getProjectTasksTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = getProjectTasksSchema.parse(args);
    
    const response = await client.listTasks({
      project_id: params.project_id,
      status: params.status,
      limit: 200, // Get maximum tasks for a project
    });
    
    if (!response || !response.data || response.data.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No tasks found for project ${params.project_id}.`,
        }],
      };
    }
    
    // Build lookup maps from included relationships
    const included = response.included || [];
    const peopleMap = new Map<string, string>();
    const statusMap = new Map<string, string>();
    for (const inc of included) {
      if (inc.type === 'people') peopleMap.set(inc.id, `${inc.attributes?.first_name || ''} ${inc.attributes?.last_name || ''}`.trim());
      if (inc.type === 'workflow_statuses') statusMap.set(inc.id, String(inc.attributes?.name || ''));
    }

    const tasksText = response.data.filter(task => task && task.attributes).map(task => {
      const assigneeData = task.relationships?.assignee?.data;
      let assigneeText = 'Unassigned';
      if (assigneeData) {
        assigneeText = peopleMap.get(assigneeData.id) || `ID:${assigneeData.id}`;
      }
      const wsId = task.relationships?.workflow_status?.data?.id;
      const statusText = wsId && statusMap.get(wsId) ? statusMap.get(wsId) : (task.attributes.status === 1 ? 'open' : task.attributes.status === 2 ? 'closed' : `status ${task.attributes.status}`);
      return `• ${task.attributes.title} (ID: ${task.id})
  Status: ${statusText} | Assignee: ${assigneeText}
  ${task.attributes.due_date ? `Due: ${task.attributes.due_date}` : 'No due date'}
  ${task.attributes.worked_time ? `Tracked: ${(task.attributes.worked_time / 60).toFixed(1)}h` : 'No time tracked'}`;
    }).join('\n\n');

    const totalTracked = response.data.reduce((sum, t) => sum + (t.attributes?.worked_time || 0), 0);
    const summary = `Project ${params.project_id} has ${response.data.length} task${response.data.length !== 1 ? 's' : ''}${totalTracked ? ` (Total tracked: ${(totalTracked / 60).toFixed(1)}h)` : ''}:\n\n${tasksText}`;
    
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

export async function getTaskTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = getTaskSchema.parse(args);

    const response = await client.getTask(params.task_id, { include: 'task_list' });
    const task = response.data;
    const projectId = task.relationships?.project?.data?.id;
    const assigneeId = task.relationships?.assignee?.data?.id;
    const taskListId = task.relationships?.task_list?.data?.id;

    const statusText = task.attributes.closed === false ? 'open' : task.attributes.closed === true ? 'closed' : 'unknown';

    let text = `Task Details:\n\n`;
    text += `Title: ${task.attributes.title}\n`;
    text += `ID: ${task.id}\n`;
    text += `Status: ${statusText}\n`;

    if (task.attributes.description) {
      text += `Description: ${task.attributes.description}\n`;
    }

    text += `Due Date: ${task.attributes.due_date || 'No due date set'}\n`;

    if (projectId) {
      text += `Project ID: ${projectId}\n`;
    }

    if (assigneeId) {
      text += `Assignee ID: ${assigneeId}\n`;
    } else {
      text += `Assignee: Unassigned\n`;
    }

    if (task.attributes.created_at) {
      text += `Created: ${task.attributes.created_at}\n`;
    }

    if (task.attributes.updated_at) {
      text += `Updated: ${task.attributes.updated_at}\n`;
    }

    if (task.attributes.priority !== undefined) {
      text += `Priority: ${task.attributes.priority}\n`;
    }

    if (task.attributes.placement !== undefined) {
      text += `Position: ${task.attributes.placement}\n`;
    }

    if (task.attributes.task_number) {
      text += `Task Number: ${task.attributes.task_number}\n`;
    }

    if (task.attributes.private !== undefined) {
      text += `Private: ${task.attributes.private ? 'Yes' : 'No'}\n`;
    }

    if (task.attributes.initial_estimate) {
      text += `Initial Estimate: ${task.attributes.initial_estimate}\n`;
    }

    if (task.attributes.worked_time) {
      text += `Worked Time: ${task.attributes.worked_time}\n`;
    }

    if (task.attributes.last_activity_at) {
      text += `Last Activity: ${task.attributes.last_activity_at}\n`;
    }

    if (taskListId) {
      text += `Task List ID: ${taskListId}\n`;
      const taskList = response.included?.find(item => item.type === 'task_lists' && item.id === taskListId);
      if (taskList) {
        text += `Task List: ${taskList.attributes.name}\n`;
      }
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

export const listTasksDefinition = {
  name: 'list_tasks',
  description: 'Get a list of tasks from Productive.io. Includes project name, assignee, workflow status, and date fields. Supports text search, date-range filters, and sorting.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: { type: 'string', description: 'Filter tasks by project ID' },
      assignee_id: { type: 'string', description: 'Filter tasks by assignee ID' },
      status: { type: 'string', enum: ['open', 'closed'], description: 'Filter by task status' },
      query: { type: 'string', description: 'Text search across task titles and descriptions' },
      due_date_after: { type: 'string', description: 'Filter tasks due after this date (YYYY-MM-DD)' },
      due_date_before: { type: 'string', description: 'Filter tasks due before this date (YYYY-MM-DD)' },
      task_list_id: { type: 'string', description: 'Filter by task list ID' },
      board_id: { type: 'string', description: 'Filter by board ID' },
      company_id: { type: 'string', description: 'Filter by company ID' },
      closed_after: { type: 'string', description: 'Filter tasks closed after this date (YYYY-MM-DD)' },
      closed_before: { type: 'string', description: 'Filter tasks closed before this date (YYYY-MM-DD)' },
      last_activity_after: { type: 'string', description: 'Filter tasks with last activity after this date (YYYY-MM-DD)' },
      last_activity_before: { type: 'string', description: 'Filter tasks with last activity before this date (YYYY-MM-DD)' },
      sort: { type: 'string', description: 'Sort field. Prefix with - for descending. Options: created_at, updated_at, closed_at, last_activity_at, due_date, title, worked_time, project_name. Example: -last_activity_at' },
      limit: { type: 'number', description: 'Number of tasks to return (1-200)', minimum: 1, maximum: 200, default: 30 },
    },
  },
};

export const getProjectTasksDefinition = {
  name: 'get_project_tasks',
  description: 'Get all tasks for a specific project. ALSO used as STEP 4 in timesheet workflow to find task_id for linking time entries to specific tasks. Workflow: list_projects → list_project_deals → list_deal_services → get_project_tasks → create_time_entry.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'string',
        description: 'The ID of the project',
      },
      status: {
        type: 'string',
        enum: ['open', 'closed'],
        description: 'Filter by task status (open or closed)',
      },
    },
    required: ['project_id'],
  },
};

export const getTaskDefinition = {
  name: 'get_task',
  description: 'Get detailed information about a specific task by ID',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'The ID of the task to retrieve',
      },
    },
    required: ['task_id'],
  },
};

const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  project_id: z.string().optional(),
  board_id: z.string().optional(),
  task_list_id: z.string().optional(),
  assignee_id: z.string().optional(),
  due_date: z.string().optional(),
  initial_estimate: z.number().optional().describe('Estimated time in minutes'),
  priority: z.number().int().min(0).max(3).optional().describe('0=none, 1=low, 2=medium, 3=high'),
  status: z.enum(['open', 'closed']).optional().default('open'),
});

export async function createTaskTool(
  client: ProductiveAPIClient,
  args: unknown,
  config?: { PRODUCTIVE_USER_ID?: string }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = createTaskSchema.parse(args || {});
    
    // Handle "me" reference for assignee
    let assigneeId = params.assignee_id;
    if (assigneeId === 'me') {
      if (!config?.PRODUCTIVE_USER_ID) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Cannot use "me" reference - PRODUCTIVE_USER_ID is not configured in environment'
        );
      }
      assigneeId = config.PRODUCTIVE_USER_ID;
    }
    
    const taskData = {
      data: {
        type: 'tasks' as const,
        attributes: {
          title: params.title,
          description: params.description,
          due_date: params.due_date,
          ...(params.initial_estimate !== undefined && { initial_estimate: params.initial_estimate }),
          ...(params.priority !== undefined && { priority: params.priority }),
          status: params.status === 'open' ? 1 : 2,
        },
        relationships: {} as any,
      },
    };

    // Add relationships if provided
    if (params.project_id) {
      taskData.data.relationships.project = {
        data: {
          id: params.project_id,
          type: 'projects' as const,
        },
      };
    }

    if (params.board_id) {
      taskData.data.relationships.board = {
        data: {
          id: params.board_id,
          type: 'boards' as const,
        },
      };
    }

    if (params.task_list_id) {
      taskData.data.relationships.task_list = {
        data: {
          id: params.task_list_id,
          type: 'task_lists' as const,
        },
      };
    }

    if (assigneeId) {
      taskData.data.relationships.assignee = {
        data: {
          id: assigneeId,
          type: 'people' as const,
        },
      };
    }
    
    const response = await client.createTask(taskData);
    
    let text = `Task created successfully!\n`;
    text += `Title: ${response.data.attributes.title} (ID: ${response.data.id})`;
    if (response.data.attributes.description) {
      text += `\nDescription: ${response.data.attributes.description}`;
    }
    const statusText = response.data.attributes.status === 1 ? 'open' : 'closed';
    text += `\nStatus: ${statusText}`;
    if (response.data.attributes.due_date) {
      text += `\nDue date: ${response.data.attributes.due_date}`;
    }
    if (params.project_id) {
      text += `\nProject ID: ${params.project_id}`;
    }
    if (params.board_id) {
      text += `\nBoard ID: ${params.board_id}`;
    }
    if (params.task_list_id) {
      text += `\nTask List ID: ${params.task_list_id}`;
    }
    if (assigneeId) {
      text += `\nAssignee ID: ${assigneeId}`;
      if (params.assignee_id === 'me' && config?.PRODUCTIVE_USER_ID) {
        text += ` (me)`;
      }
    }
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

export const createTaskDefinition = {
  name: 'create_task',
  description: 'Create a new task in Productive.io. If PRODUCTIVE_USER_ID is configured, you can use "me" to refer to the configured user when assigning.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Task title (required)',
      },
      description: {
        type: 'string',
        description: 'Task description',
      },
      project_id: {
        type: 'string',
        description: 'ID of the project to add the task to',
      },
      board_id: {
        type: 'string',
        description: 'ID of the board to add the task to',
      },
      task_list_id: {
        type: 'string',
        description: 'ID of the task list to add the task to',
      },
      assignee_id: {
        type: 'string',
        description: 'ID of the person to assign the task to. If PRODUCTIVE_USER_ID is configured in environment, "me" refers to that user.',
      },
      due_date: {
        type: 'string',
        description: 'Due date in YYYY-MM-DD format',
      },
      initial_estimate: {
        type: 'number',
        description: 'Estimated time in minutes (e.g. 120 = 2 hours)',
      },
      priority: {
        type: 'number',
        description: 'Priority: 0=none, 1=low, 2=medium, 3=high',
        minimum: 0,
        maximum: 3,
      },
      status: {
        type: 'string',
        enum: ['open', 'closed'],
        description: 'Task status (default: open)',
      },
    },
    required: ['title'],
  },
};

const updateTaskAssignmentSchema = z.object({
  task_id: z.string().min(1, 'Task ID is required'),
  assignee_id: z.string().describe('ID of the person to assign (use "null" string to unassign)'),
});

export async function updateTaskAssignmentTool(
  client: ProductiveAPIClient,
  args: unknown,
  config?: { PRODUCTIVE_USER_ID?: string }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = updateTaskAssignmentSchema.parse(args);
    
    // Handle "me" reference and "null" string
    let assigneeId: string | null = params.assignee_id;
    if (assigneeId === 'me') {
      if (!config?.PRODUCTIVE_USER_ID) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Cannot use "me" reference - PRODUCTIVE_USER_ID is not configured in environment'
        );
      }
      assigneeId = config.PRODUCTIVE_USER_ID;
    } else if (assigneeId === 'null') {
      assigneeId = null;
    }
    
    const taskUpdate: ProductiveTaskUpdate = {
      data: {
        type: 'tasks',
        id: params.task_id,
        relationships: assigneeId ? {
          assignee: {
            data: {
              id: assigneeId,
              type: 'people'
            }
          }
        } : {
          assignee: {
            data: null
          }
        }
      }
    };
    
    const response = await client.updateTask(params.task_id, taskUpdate);
    
    let text = `Task assignment updated successfully!\n`;
    text += `Task: ${response.data.attributes.title} (ID: ${response.data.id})\n`;
    
    if (assigneeId) {
      text += `Assigned to: Person ID ${assigneeId}`;
      if (params.assignee_id === 'me' && config?.PRODUCTIVE_USER_ID) {
        text += ` (me)`;
      }
    } else {
      text += `Task is now unassigned`;
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

export const updateTaskAssignmentDefinition = {
  name: 'update_task_assignment',
  description: 'Update the assignee of an existing task. If PRODUCTIVE_USER_ID is configured, you can use "me" to refer to the configured user. To unassign, use "null" as a string.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'ID of the task to update (required)',
      },
      assignee_id: {
        type: 'string',
        description: 'ID of the person to assign the task to (use "null" string to unassign). If PRODUCTIVE_USER_ID is configured in environment, "me" refers to that user.',
      },
    },
    required: ['task_id', 'assignee_id'],
  },
};

const updateTaskDetailsSchema = z.object({
  task_id: z.string().min(1, 'Task ID is required'),
  title: z.string().min(1, 'Task title cannot be empty').optional(),
  description: z.string().optional(),
  due_date: z.string().optional(),
  initial_estimate: z.number().optional().describe('Estimated time in minutes'),
  priority: z.number().int().min(0).max(3).optional().describe('0=none, 1=low, 2=medium, 3=high'),
});

export async function updateTaskDetailsTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = updateTaskDetailsSchema.parse(args);
    
    // Ensure at least one field is being updated
    if (!params.title && params.description === undefined && params.due_date === undefined && params.initial_estimate === undefined && params.priority === undefined) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'At least one field (title, description, due_date, initial_estimate, or priority) must be provided for update'
      );
    }
    
    const taskUpdate: ProductiveTaskUpdate = {
      data: {
        type: 'tasks',
        id: params.task_id,
        attributes: {}
      }
    };
    
    // Only include fields that are being updated
    if (params.title) {
      taskUpdate.data.attributes!.title = params.title;
    }
    
    if (params.description !== undefined) {
      taskUpdate.data.attributes!.description = params.description;
    }

    if (params.due_date !== undefined) {
      taskUpdate.data.attributes!.due_date = params.due_date;
    }

    if (params.initial_estimate !== undefined) {
      (taskUpdate.data.attributes as Record<string, unknown>).initial_estimate = params.initial_estimate;
    }

    if (params.priority !== undefined) {
      (taskUpdate.data.attributes as Record<string, unknown>).priority = params.priority;
    }

    const response = await client.updateTask(params.task_id, taskUpdate);
    
    let text = `Task details updated successfully!\n`;
    text += `Task: ${response.data.attributes.title} (ID: ${response.data.id})\n`;
    
    if (params.title) {
      text += `✓ Title updated to: "${response.data.attributes.title}"\n`;
    }
    
    if (params.description !== undefined) {
      if (response.data.attributes.description) {
        text += `✓ Description updated to: "${response.data.attributes.description}"\n`;
      } else {
        text += `✓ Description cleared\n`;
      }
    }

    if (params.due_date !== undefined) {
      text += `✓ Due date set to: ${response.data.attributes.due_date}\n`;
    }

    if (response.data.attributes.updated_at) {
      text += `Updated at: ${response.data.attributes.updated_at}`;
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

export const updateTaskDetailsDefinition = {
  name: 'update_task_details',
  description: 'Update task details: title, description, due date, initial estimate, and/or priority. At least one field must be provided.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'ID of the task to update (required)' },
      title: { type: 'string', description: 'New title/name for the task' },
      description: { type: 'string', description: 'New description (use empty string to clear)' },
      due_date: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
      initial_estimate: { type: 'number', description: 'Estimated time in minutes (e.g. 120 = 2 hours)' },
      priority: { type: 'number', description: 'Priority: 0=none, 1=low, 2=medium, 3=high', minimum: 0, maximum: 3 },
    },
    required: ['task_id'],
  },
};

const deleteTaskSchema = z.object({
  task_id: z.string().min(1, 'Task ID is required'),
});

export async function deleteTaskTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = deleteTaskSchema.parse(args);
    await client.deleteTask(params.task_id);
    return { content: [{ type: 'text', text: `Task ${params.task_id} deleted successfully.` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const deleteTaskDefinition = {
  name: 'delete_task',
  description: 'Delete a task in Productive.io. This is permanent.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'Task ID to delete (required)' },
    },
    required: ['task_id'],
  },
};
