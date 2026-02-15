import { z } from 'zod';
import type { ProductiveAPIClient } from '../api/client.js';
import type { TaskReposition } from '../api/types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export const taskRepositionSchema = z.object({
  taskId: z.string().describe('The ID of the task to reposition'),
  move_before_id: z.string().optional().describe('Position the task before this task ID'),
  move_after_id: z.string().optional().describe('Position the task after this task ID'),
  moveToTop: z.boolean().optional().describe('Move the task to the top of its list'),
  moveToBottom: z.boolean().optional().describe('Move the task to the bottom of its list'),
});

export const repositionTask = async (
  apiClient: ProductiveAPIClient,
  data: z.infer<typeof taskRepositionSchema>
) => {
  const { taskId, move_before_id, move_after_id, moveToTop, moveToBottom } = data;

  // Get the current task to determine its task list
  const currentTask = await apiClient.getTask(taskId, { include: 'task_list' });
  const taskListId = currentTask.data.relationships?.task_list?.data?.id;

  if (moveToTop || moveToBottom) {
    // Fetch tasks to find positioning targets
    const allTasks = await apiClient.listTasks({ limit: 100 });

    // Filter to same task list if known, otherwise use all tasks
    const candidates = taskListId
      ? allTasks.data.filter(task => task.relationships?.task_list?.data?.id === taskListId && task.id !== taskId)
      : allTasks.data.filter(task => task.id !== taskId);

    if (candidates.length > 0) {
      const sorted = [...candidates].sort((a, b) => (a.attributes.placement || 0) - (b.attributes.placement || 0));

      if (moveToTop) {
        return await apiClient.repositionTask(taskId, { move_before_id: sorted[0].id });
      }
      if (moveToBottom) {
        return await apiClient.repositionTask(taskId, { move_after_id: sorted[sorted.length - 1].id });
      }
    }
  }

  // Handle explicit positioning parameters
  if (move_before_id || move_after_id) {
    const attributes: TaskReposition = {};
    if (move_before_id) attributes.move_before_id = move_before_id;
    if (move_after_id) attributes.move_after_id = move_after_id;
    return await apiClient.repositionTask(taskId, attributes);
  }

  return await apiClient.repositionTask(taskId, {});
};

export const taskRepositionDefinition = {
  name: 'reposition_task',
  description: 'Reposition a task in a task list',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'The ID of the task to reposition'
      },
      move_before_id: {
        type: 'string',
        description: 'Position the task before this task ID'
      },
      move_after_id: {
        type: 'string',
        description: 'Position the task after this task ID'
      },
      moveToTop: {
        type: 'boolean',
        description: 'Move the task to the top of its list'
      },
      moveToBottom: {
        type: 'boolean',
        description: 'Move the task to the bottom of its list'
      }
    },
    required: ['taskId']
  }
};

export const taskRepositionTool = async (apiClient: ProductiveAPIClient, args: z.infer<typeof taskRepositionSchema>) => {
  try {
    const result = await repositionTask(apiClient, args);

    const direction = args.moveToTop ? 'to the top of the list' :
                      args.moveToBottom ? 'to the bottom of the list' :
                      args.move_before_id ? `before task ${args.move_before_id}` :
                      args.move_after_id ? `after task ${args.move_after_id}` :
                      'to a new position';

    if (result?.data) {
      return {
        content: [{
          type: 'text',
          text: `Task ${result.data.id} repositioned successfully ${direction}.\nTitle: ${result.data.attributes?.title || 'Unknown'}`,
        }],
      };
    }

    // 204 No Content (undefined result) = success
    return {
      content: [{
        type: 'text',
        text: `Task ${args.taskId} repositioned successfully ${direction}.`,
      }],
    };
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
};
