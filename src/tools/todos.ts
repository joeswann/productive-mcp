import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { Config } from '../config/index.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// ── List Todos ──

const listTodosSchema = z.object({
  task_id: z.string().optional(),
  deal_id: z.string().optional(),
  assignee_id: z.string().optional(),
  status: z.enum(['open', 'closed']).optional(),
  due_date: z.string().optional(),
  limit: z.number().min(1).max(200).default(30).optional(),
  page: z.number().min(1).optional(),
});

export async function listTodosTool(
  client: ProductiveAPIClient,
  args: unknown,
  config: Config
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listTodosSchema.parse(args || {});

    let assigneeId = params.assignee_id;
    if (assigneeId === 'me') {
      if (!config.PRODUCTIVE_USER_ID) {
        throw new McpError(ErrorCode.InvalidParams, 'Cannot use "me" reference - PRODUCTIVE_USER_ID is not configured');
      }
      assigneeId = config.PRODUCTIVE_USER_ID;
    }

    const statusValue = params.status === 'open' ? 1 : params.status === 'closed' ? 2 : undefined;

    const response = await client.listTodos({
      task_id: params.task_id,
      deal_id: params.deal_id,
      assignee_id: assigneeId,
      status: statusValue,
      due_date: params.due_date,
      limit: params.limit,
      page: params.page,
    });

    if (!response.data || response.data.length === 0) {
      return { content: [{ type: 'text', text: 'No todos found.' }] };
    }

    const includedMap = new Map<string, Record<string, unknown>>();
    if (response.included) {
      for (const inc of response.included) {
        includedMap.set(`${inc.type}:${inc.id}`, inc.attributes);
      }
    }

    const items = response.data.map(todo => {
      const a = todo.attributes;
      const icon = a.closed ? '✓' : '○';
      const assigneeId = todo.relationships?.assignee?.data?.id;
      const taskId = todo.relationships?.task?.data?.id;
      const dealId = todo.relationships?.deal?.data?.id;

      let line = `${icon} ${a.description} (ID: ${todo.id})`;
      if (assigneeId) {
        const person = includedMap.get(`people:${assigneeId}`);
        const name = person ? `${person.first_name} ${person.last_name}`.trim() : `ID ${assigneeId}`;
        line += `\n  Assignee: ${name}`;
      }
      if (a.due_date) line += `\n  Due: ${a.due_date}`;
      if (taskId) {
        const task = includedMap.get(`tasks:${taskId}`);
        line += `\n  Task: ${task?.title || `ID ${taskId}`}`;
      }
      if (dealId) {
        const deal = includedMap.get(`deals:${dealId}`);
        line += `\n  Deal: ${deal?.name || `ID ${dealId}`}`;
      }
      return line;
    }).join('\n\n');

    const total = response.meta?.total_count;
    const summary = `Found ${response.data.length} todo${response.data.length !== 1 ? 's' : ''}${total ? ` (showing ${response.data.length} of ${total})` : ''}:\n\n${items}`;
    return { content: [{ type: 'text', text: summary }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const listTodosDefinition = {
  name: 'list_todos',
  description: 'List todos (lightweight checklist items on tasks or deals). Use assignee_id "me" for your todos.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'Filter by task ID' },
      deal_id: { type: 'string', description: 'Filter by deal ID' },
      assignee_id: { type: 'string', description: 'Filter by assignee ID (use "me" for yourself)' },
      status: { type: 'string', enum: ['open', 'closed'], description: 'Filter by status' },
      due_date: { type: 'string', description: 'Filter by due date (YYYY-MM-DD)' },
      limit: { type: 'number', description: 'Results per page (1-200, default 30)', minimum: 1, maximum: 200 },
      page: { type: 'number', description: 'Page number', minimum: 1 },
    },
  },
};

// ── Create Todo ──

const createTodoSchema = z.object({
  description: z.string(),
  assignee_id: z.string().optional(),
  task_id: z.string().optional(),
  deal_id: z.string().optional(),
  due_date: z.string().optional(),
  due_time: z.string().optional(),
});

export async function createTodoTool(
  client: ProductiveAPIClient,
  args: unknown,
  config: Config
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = createTodoSchema.parse(args);

    let assigneeId = params.assignee_id || 'me';
    if (assigneeId === 'me') {
      if (!config.PRODUCTIVE_USER_ID) {
        throw new McpError(ErrorCode.InvalidParams, 'Cannot use "me" reference - PRODUCTIVE_USER_ID is not configured');
      }
      assigneeId = config.PRODUCTIVE_USER_ID;
    }

    if (!params.task_id && !params.deal_id) {
      throw new McpError(ErrorCode.InvalidParams, 'Either task_id or deal_id is required');
    }

    const relationships: Record<string, { data: { id: string; type: string } }> = {
      assignee: { data: { id: assigneeId, type: 'people' } },
    };
    if (params.task_id) {
      relationships.task = { data: { id: params.task_id, type: 'tasks' } };
    }
    if (params.deal_id) {
      relationships.deal = { data: { id: params.deal_id, type: 'deals' } };
    }

    const response = await client.createTodo({
      data: {
        type: 'todos',
        attributes: {
          description: params.description,
          due_date: params.due_date,
          due_time: params.due_time,
        },
        relationships: relationships as { assignee: { data: { id: string; type: 'people' } } },
      },
    });

    const todo = response.data;
    let text = `Created todo "${todo.attributes.description}" (ID: ${todo.id})`;
    if (params.due_date) text += `\nDue: ${params.due_date}`;
    return { content: [{ type: 'text', text }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const createTodoDefinition = {
  name: 'create_todo',
  description: 'Create a todo (checklist item) on a task or deal. Defaults assignee to "me" if not specified.',
  inputSchema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'Todo text' },
      assignee_id: { type: 'string', description: 'Assignee person ID (defaults to "me")' },
      task_id: { type: 'string', description: 'Parent task ID (required if no deal_id)' },
      deal_id: { type: 'string', description: 'Parent deal ID (required if no task_id)' },
      due_date: { type: 'string', description: 'Due date (YYYY-MM-DD)' },
      due_time: { type: 'string', description: 'Due time (HH:MM)' },
    },
    required: ['description'],
  },
};

// ── Update Todo ──

const updateTodoSchema = z.object({
  todo_id: z.string(),
  description: z.string().optional(),
  closed: z.boolean().optional(),
  due_date: z.string().nullable().optional(),
});

export async function updateTodoTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = updateTodoSchema.parse(args);
    const attributes: Record<string, unknown> = {};
    if (params.description !== undefined) attributes.description = params.description;
    if (params.closed !== undefined) attributes.closed = params.closed;
    if (params.due_date !== undefined) attributes.due_date = params.due_date;

    const response = await client.updateTodo(params.todo_id, {
      data: {
        type: 'todos',
        id: params.todo_id,
        attributes: attributes as { description?: string; closed?: boolean; due_date?: string | null },
      },
    });

    const todo = response.data;
    const icon = todo.attributes.closed ? '✓' : '○';
    return { content: [{ type: 'text', text: `${icon} Updated todo "${todo.attributes.description}" (ID: ${todo.id})` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const updateTodoDefinition = {
  name: 'update_todo',
  description: 'Update a todo. Use closed: true to complete it, closed: false to reopen.',
  inputSchema: {
    type: 'object',
    properties: {
      todo_id: { type: 'string', description: 'Todo ID' },
      description: { type: 'string', description: 'New description text' },
      closed: { type: 'boolean', description: 'Set to true to close, false to reopen' },
      due_date: { type: 'string', description: 'New due date (YYYY-MM-DD) or null to remove', nullable: true },
    },
    required: ['todo_id'],
  },
};

// ── Delete Todo ──

const deleteTodoSchema = z.object({
  todo_id: z.string(),
});

export async function deleteTodoTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { todo_id } = deleteTodoSchema.parse(args);
    await client.deleteTodo(todo_id);
    return { content: [{ type: 'text', text: `Deleted todo ${todo_id}` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const deleteTodoDefinition = {
  name: 'delete_todo',
  description: 'Delete a todo.',
  inputSchema: {
    type: 'object',
    properties: {
      todo_id: { type: 'string', description: 'Todo ID' },
    },
    required: ['todo_id'],
  },
};
