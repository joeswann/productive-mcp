import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const ListTaskListsSchema = z.object({
  board_id: z.string().optional().describe('Filter task lists by board ID'),
  limit: z.number().optional().default(30).describe('Number of task lists to return (max 200)'),
});

export async function listTaskLists(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = ListTaskListsSchema.parse(args || {});
    
    const response = await client.listTaskLists({
      board_id: params.board_id,
      limit: params.limit,
    });
    
    if (!response || !response.data || response.data.length === 0) {
      const filterText = params.board_id ? ` for board ${params.board_id}` : '';
      return {
        content: [{
          type: 'text',
          text: `No task lists found${filterText}`,
        }],
      };
    }
    
    const taskListsText = response.data.filter(taskList => taskList && taskList.attributes).map(taskList => {
      let text = `Task List: ${taskList.attributes.name} (ID: ${taskList.id})`;
      if (taskList.attributes.description) {
        text += `\nDescription: ${taskList.attributes.description}`;
      }
      if (taskList.attributes.position !== undefined) {
        text += `\nPosition: ${taskList.attributes.position}`;
      }
      if (taskList.relationships?.board?.data?.id) {
        text += `\nBoard ID: ${taskList.relationships.board.data.id}`;
      }
      return text;
    }).join('\n\n');
    
    return {
      content: [{
        type: 'text',
        text: taskListsText,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    
    if (error instanceof Error) {
      throw new McpError(
        ErrorCode.InternalError,
        `API error: ${error.message}`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      'Unknown error occurred while fetching task lists'
    );
  }
}

export const listTaskListsTool = {
  name: 'list_task_lists',
  description: 'Get a list of task lists from Productive.io. Task lists organize tasks within boards.',
  inputSchema: {
    type: 'object',
    properties: {
      board_id: {
        type: 'string',
        description: 'Filter task lists by board ID',
      },
      limit: {
        type: 'number',
        description: 'Number of task lists to return (max 200)',
        default: 30,
      },
    },
  },
};

const GetTaskListSchema = z.object({
  id: z.string().min(1, 'Task list ID is required'),
});

export async function getTaskList(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = GetTaskListSchema.parse(args);
    const response = await client.getTaskList(params.id);
    const tl = response.data;
    let text = `Task List: ${tl.attributes.name} (ID: ${tl.id})`;
    if (tl.attributes.description) text += `\nDescription: ${tl.attributes.description}`;
    if (tl.relationships?.board?.data?.id) text += `\nBoard ID: ${tl.relationships.board.data.id}`;
    text += `\nCreated: ${tl.attributes.created_at}`;
    return { content: [{ type: 'text', text }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const getTaskListTool = {
  name: 'get_task_list',
  description: 'Get a single task list by ID from Productive.io.',
  inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Task list ID (required)' } }, required: ['id'] },
};

const DeleteTaskListSchema = z.object({
  id: z.string().min(1, 'Task list ID is required'),
});

export async function deleteTaskList(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = DeleteTaskListSchema.parse(args);
    await client.deleteTaskList(params.id);
    return { content: [{ type: 'text', text: `Task list ${params.id} deleted successfully.` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const deleteTaskListTool = {
  name: 'delete_task_list',
  description: 'Delete a task list in Productive.io.',
  inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Task list ID to delete (required)' } }, required: ['id'] },
};

const UpdateTaskListSchema = z.object({
  id: z.string().min(1, 'Task list ID is required'),
  name: z.string().min(1, 'Task list name is required'),
});

export async function updateTaskList(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = UpdateTaskListSchema.parse(args);

    const response = await client.updateTaskList(params.id, {
      data: {
        type: 'task_lists',
        id: params.id,
        attributes: { name: params.name },
      },
    });

    return {
      content: [{
        type: 'text',
        text: `Task list ${params.id} updated successfully!\nName: ${response.data.attributes.name}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const updateTaskListTool = {
  name: 'update_task_list',
  description: 'Update a task list name in Productive.io.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Task list ID to update (required)' },
      name: { type: 'string', description: 'New task list name (required)' },
    },
    required: ['id', 'name'],
  },
};

const CreateTaskListSchema = z.object({
  board_id: z.string().describe('The ID of the board to create the task list in'),
  project_id: z.string().describe('The ID of the project'),
  name: z.string().describe('Name of the task list'),
  description: z.string().optional().describe('Description of the task list'),
});

export async function createTaskList(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = CreateTaskListSchema.parse(args);
    
    const taskListData = {
      data: {
        type: 'task_lists' as const,
        attributes: {
          name: params.name,
          ...(params.description && { description: params.description }),
          position: 0,
        },
        relationships: {
          board: {
            data: {
              id: params.board_id,
              type: 'boards' as const,
            },
          },
          project: {
            data: {
              id: params.project_id,
              type: 'projects' as const,
            },
          },
        },
      },
    };
    
    const response = await client.createTaskList(taskListData);
    
    let text = `Task list created successfully!\n`;
    text += `Name: ${response.data.attributes.name} (ID: ${response.data.id})`;
    if (response.data.attributes.description) {
      text += `\nDescription: ${response.data.attributes.description}`;
    }
    text += `\nBoard ID: ${params.board_id}`;
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
        `Invalid parameters: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    
    if (error instanceof Error) {
      throw new McpError(
        ErrorCode.InternalError,
        `API error: ${error.message}`
      );
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      'Unknown error occurred while creating task list'
    );
  }
}

export const createTaskListTool = {
  name: 'create_task_list',
  description: 'Create a new task list in a Productive.io board. Task lists help organize tasks within boards.',
  inputSchema: {
    type: 'object',
    properties: {
      board_id: {
        type: 'string',
        description: 'The ID of the board to create the task list in',
      },
      project_id: {
        type: 'string',
        description: 'The ID of the project',
      },
      name: {
        type: 'string',
        description: 'Name of the task list',
      },
      description: {
        type: 'string',
        description: 'Description of the task list',
      },
    },
    required: ['board_id', 'project_id', 'name'],
  },
};
