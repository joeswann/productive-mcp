import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { ProductiveProjectCreate, ProductiveProjectUpdate } from '../api/types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  company_id: z.string().min(1, 'Company ID is required'),
  description: z.string().optional(),
  project_type_id: z.number().int().min(1).max(2).default(2).optional(),
  project_manager_id: z.string().optional(),
  workflow_id: z.string().optional(),
});

const listProjectsSchema = z.object({
  status: z.enum(['active', 'archived', 'all']).default('all').optional(),
  company_id: z.string().optional(),
  template: z.preprocess(val => val === 'true' ? true : val === 'false' ? false : val, z.boolean()).optional(),
  limit: z.number().min(1).max(200).default(30).optional(),
});

export async function listProjectsTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listProjectsSchema.parse(args || {});

    let allData: Array<{ id: string; attributes: Record<string, unknown>; relationships?: Record<string, unknown> }> = [];

    if (params.status === 'all' || !params.status) {
      // Fetch both active and archived, splitting the limit between them
      const halfLimit = Math.ceil((params.limit || 30) / 2);
      const [activeResp, archivedResp] = await Promise.all([
        client.listProjects({ status: 'active', company_id: params.company_id, template: params.template, limit: halfLimit }),
        client.listProjects({ status: 'archived', company_id: params.company_id, template: params.template, limit: halfLimit }),
      ]);
      allData = [...(activeResp?.data || []), ...(archivedResp?.data || [])];
    } else {
      const response = await client.listProjects({
        status: params.status,
        company_id: params.company_id,
        template: params.template,
        limit: params.limit,
      });
      allData = response?.data || [];
    }

    if (allData.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No projects found matching the criteria.',
        }],
      };
    }

    const projectsText = allData.filter(project => project && project.attributes).map(project => {
      const companyId = (project.relationships?.company as { data?: { id?: string } } | undefined)?.data?.id;
      const isArchived = project.attributes.archived_at || project.attributes.status === 'archived';
      return `• ${project.attributes.name} (ID: ${project.id})${isArchived ? ' [ARCHIVED]' : ''}
  Status: ${project.attributes.status}
  ${companyId ? `Company ID: ${companyId}` : ''}
  ${project.attributes.description ? `Description: ${project.attributes.description}` : 'No description'}`;
    }).join('\n\n');

    const summary = `Found ${allData.length} project${allData.length !== 1 ? 's' : ''}:\n\n${projectsText}`;
    
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

export async function createProjectTool(
  client: ProductiveAPIClient,
  args: unknown,
  config?: { PRODUCTIVE_USER_ID?: string }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = createProjectSchema.parse(args);

    // Resolve project manager: default to configured user
    let managerId = params.project_manager_id;
    if (!managerId || managerId === 'me') {
      if (!config?.PRODUCTIVE_USER_ID) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'project_manager_id is required (or set PRODUCTIVE_USER_ID to use "me")'
        );
      }
      managerId = config.PRODUCTIVE_USER_ID;
    }

    // Resolve workflow: auto-detect if not provided
    let workflowId = params.workflow_id;
    if (!workflowId) {
      const workflows = await client.listWorkflows({ limit: 10 });
      if (!workflows.data || workflows.data.length === 0) {
        throw new McpError(
          ErrorCode.InternalError,
          'No workflows found. Please provide a workflow_id.'
        );
      }
      // Use the first non-archived workflow
      const active = workflows.data.find(w => !w.attributes.archived_at);
      workflowId = (active || workflows.data[0]).id;
    }

    const projectData: ProductiveProjectCreate = {
      data: {
        type: 'projects',
        attributes: {
          name: params.name,
          project_type_id: params.project_type_id ?? 2,
          ...(params.description && { description: params.description }),
        },
        relationships: {
          company: {
            data: {
              id: params.company_id,
              type: 'companies',
            },
          },
          project_manager: {
            data: {
              id: managerId,
              type: 'people',
            },
          },
          workflow: {
            data: {
              id: workflowId,
              type: 'workflows',
            },
          },
        },
      },
    };

    const response = await client.createProject(projectData);

    const project = response.data;
    return {
      content: [{
        type: 'text',
        text: `Project created successfully!\n\nName: ${project.attributes.name}\nID: ${project.id}\nStatus: ${project.attributes.status}\nCompany ID: ${params.company_id}\nProject Manager ID: ${managerId}\nWorkflow ID: ${workflowId}${project.attributes.description ? `\nDescription: ${project.attributes.description}` : ''}`,
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

export const createProjectDefinition = {
  name: 'create_project',
  description: 'Create a new project in Productive.io. Projects are linked to a company (customer). Use list_companies to find the company_id first. Defaults: project_type=client(2), project_manager=configured user, workflow=first active workflow.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Project name (e.g., "[2602] Field Studies Flora: V-Day Updates")',
      },
      company_id: {
        type: 'string',
        description: 'ID of the company/customer this project belongs to (use list_companies to find)',
      },
      description: {
        type: 'string',
        description: 'Optional project description',
      },
      project_type_id: {
        type: 'number',
        description: 'Project type: 1=internal, 2=client (default: 2)',
        minimum: 1,
        maximum: 2,
        default: 2,
      },
      project_manager_id: {
        type: 'string',
        description: 'Person ID for project manager. Defaults to configured user ("me").',
      },
      workflow_id: {
        type: 'string',
        description: 'Workflow ID. Auto-detected if not provided.',
      },
    },
    required: ['name', 'company_id'],
  },
};

const updateProjectSchema = z.object({
  id: z.string().min(1, 'Project ID is required'),
  name: z.string().optional(),
  company_id: z.string().optional(),
  project_manager_id: z.string().optional(),
  project_type_id: z.number().int().min(1).max(2).optional(),
  workflow_id: z.string().optional(),
  preferences: z.record(z.unknown()).optional(),
  archived_at: z.string().optional(),
});

export async function updateProjectTool(
  client: ProductiveAPIClient,
  args: unknown,
  config?: { PRODUCTIVE_USER_ID?: string }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = updateProjectSchema.parse(args);

    // Resolve "me" for project_manager_id
    let managerId = params.project_manager_id;
    if (managerId === 'me') {
      if (!config?.PRODUCTIVE_USER_ID) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Cannot use "me" — PRODUCTIVE_USER_ID is not configured'
        );
      }
      managerId = config.PRODUCTIVE_USER_ID;
    }

    const attributes: Record<string, unknown> = {};
    if (params.name) attributes.name = params.name;
    if (managerId) attributes.project_manager_id = parseInt(managerId, 10);
    if (params.project_type_id) attributes.project_type_id = params.project_type_id;
    if (params.workflow_id) attributes.workflow_id = parseInt(params.workflow_id, 10);
    if (params.preferences) attributes.preferences = params.preferences;
    const isUnarchive = params.archived_at === '';
    const isArchive = !!params.archived_at && params.archived_at !== '';

    // Archive and unarchive use dedicated endpoints
    if (isUnarchive) {
      await client.restoreProject(params.id);
    } else if (isArchive) {
      await client.archiveProject(params.id);
    }

    const updateData: ProductiveProjectUpdate = {
      data: {
        type: 'projects',
        id: params.id,
        attributes,
        ...(params.company_id && {
          relationships: {
            company: {
              data: {
                id: params.company_id,
                type: 'companies',
              },
            },
          },
        }),
      },
    };

    // Call updateProject if there are attributes or relationships beyond unarchiving
    let project;
    if (Object.keys(attributes).length > 0 || params.company_id) {
      const response = await client.updateProject(params.id, updateData);
      project = response.data;
    } else {
      // Only unarchive was requested — fetch current state
      const getResponse = await client.getProject(params.id);
      project = getResponse?.data;
    }

    const changes: string[] = [];
    if (params.name) changes.push(`Name: ${params.name}`);
    if (params.company_id) changes.push(`Company ID: ${params.company_id}`);
    if (managerId) changes.push(`Project Manager ID: ${managerId}`);
    if (params.project_type_id) changes.push(`Project Type: ${params.project_type_id}`);
    if (params.workflow_id) changes.push(`Workflow ID: ${params.workflow_id}`);
    if (params.preferences) changes.push(`Preferences: ${JSON.stringify(params.preferences)}`);
    if (params.archived_at === '') changes.push('Unarchived');
    else if (params.archived_at) changes.push(`Archived at: ${params.archived_at}`);

    return {
      content: [{
        type: 'text',
        text: `Project ${params.id} updated successfully!\n\nCurrent name: ${project.attributes.name}\nUpdated fields:\n${changes.map(c => `  • ${c}`).join('\n')}`,
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

export const updateProjectDefinition = {
  name: 'update_project',
  description: 'Update an existing project in Productive.io. Only provide fields you want to change.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Project ID to update (required)' },
      name: { type: 'string', description: 'New project name' },
      company_id: { type: 'string', description: 'New company ID' },
      project_manager_id: { type: 'string', description: 'New project manager person ID (use "me" for configured user)' },
      project_type_id: { type: 'number', description: 'Project type: 1=internal, 2=client', minimum: 1, maximum: 2 },
      workflow_id: { type: 'string', description: 'New workflow ID' },
      preferences: { type: 'object', description: 'Project preferences object (e.g., navigation_order)' },
      archived_at: { type: 'string', description: 'Set to a date (YYYY-MM-DD) to archive the project, or empty string to unarchive' },
    },
    required: ['id'],
  },
};

const getProjectSchema = z.object({
  id: z.string().min(1, 'Project ID is required'),
});

export async function getProjectTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = getProjectSchema.parse(args);
    const response = await client.getProject(params.id);
    const p = response.data;
    const companyId = p.relationships?.company?.data?.id;
    return {
      content: [{
        type: 'text',
        text: `Project: ${p.attributes.name} (ID: ${p.id})\nStatus: ${p.attributes.status}\n${companyId ? `Company ID: ${companyId}` : ''}\n${p.attributes.description ? `Description: ${p.attributes.description}` : 'No description'}\nCreated: ${p.attributes.created_at}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const getProjectDefinition = {
  name: 'get_project',
  description: 'Get a single project by ID from Productive.io.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Project ID (required)' },
    },
    required: ['id'],
  },
};

const deleteProjectSchema = z.object({
  id: z.string().min(1, 'Project ID is required'),
});

export async function deleteProjectTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = deleteProjectSchema.parse(args);
    await client.deleteProject(params.id);
    return {
      content: [{
        type: 'text',
        text: `Project ${params.id} deleted successfully.`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const deleteProjectDefinition = {
  name: 'delete_project',
  description: 'Permanently delete a project. WARNING: This is irreversible. To archive instead, use update_project with archived_at.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Project ID to delete (required)' },
    },
    required: ['id'],
  },
};

const copyProjectSchema = z.object({
  template_id: z.string().describe('ID of the source project to copy from'),
  name: z.string().describe('Name for the new project'),
  company_id: z.string().describe('Company ID for the new project'),
  project_type_id: z.number().int().min(1).max(2).default(2).optional(),
  copy_boards: z.boolean().default(true).optional(),
  copy_task_lists: z.boolean().default(true).optional(),
  copy_open_tasks: z.boolean().default(true).optional(),
  copy_closed_tasks: z.boolean().default(false).optional(),
  copy_budgets: z.boolean().default(false).optional(),
  copy_deals: z.boolean().default(false).optional(),
  copy_task_description: z.boolean().default(true).optional(),
  copy_assignees: z.boolean().default(false).optional(),
  copy_memberships: z.boolean().default(false).optional(),
  copy_notes: z.boolean().default(false).optional(),
});

export async function copyProjectTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = copyProjectSchema.parse(args || {});

    const copyData = {
      data: {
        type: 'projects',
        attributes: {
          name: params.name,
          template_id: parseInt(params.template_id, 10),
          company_id: parseInt(params.company_id, 10),
          project_type_id: params.project_type_id ?? 2,
          copy_boards: params.copy_boards ?? true,
          copy_task_lists: params.copy_task_lists ?? true,
          copy_open_tasks: params.copy_open_tasks ?? true,
          copy_closed_tasks: params.copy_closed_tasks ?? false,
          copy_budgets: params.copy_budgets ?? false,
          copy_deals: params.copy_deals ?? false,
          copy_task_description: params.copy_task_description ?? true,
          copy_assignees: params.copy_assignees ?? false,
          copy_memberships: params.copy_memberships ?? false,
          copy_notes: params.copy_notes ?? false,
        },
      },
    };

    const response = await client.copyProject(copyData);
    const p = response.data;

    return {
      content: [{
        type: 'text',
        text: `Project copied successfully!\nName: ${p.attributes.name} (ID: ${p.id})\nCopied from: ${params.template_id}\nCompany ID: ${params.company_id}\nDuplication status: ${p.attributes.duplication_status || 'unknown'}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const copyProjectDefinition = {
  name: 'copy_project',
  description: 'Copy/duplicate a project from an existing project or template. This properly initializes all modules (tasks, budgets, etc.) in the new project.',
  inputSchema: {
    type: 'object',
    properties: {
      template_id: { type: 'string', description: 'ID of the source project to copy from' },
      name: { type: 'string', description: 'Name for the new project' },
      company_id: { type: 'string', description: 'Company ID for the new project' },
      project_type_id: { type: 'number', description: 'Project type: 1=internal, 2=client (default: 2)', minimum: 1, maximum: 2 },
      copy_boards: { type: 'boolean', description: 'Copy boards/folders (default: true)' },
      copy_task_lists: { type: 'boolean', description: 'Copy task lists (default: true)' },
      copy_open_tasks: { type: 'boolean', description: 'Copy open tasks (default: true)' },
      copy_closed_tasks: { type: 'boolean', description: 'Copy closed tasks (default: false)' },
      copy_budgets: { type: 'boolean', description: 'Copy budgets (default: false)' },
      copy_deals: { type: 'boolean', description: 'Copy deals (default: false)' },
      copy_task_description: { type: 'boolean', description: 'Copy task descriptions (default: true)' },
      copy_assignees: { type: 'boolean', description: 'Copy task assignees (default: false)' },
      copy_memberships: { type: 'boolean', description: 'Copy project memberships (default: false)' },
      copy_notes: { type: 'boolean', description: 'Copy notes (default: false)' },
    },
    required: ['template_id', 'name', 'company_id'],
  },
};

export const listProjectsDefinition = {
  name: 'list_projects',
  description: 'Get a list of projects from Productive.io. Defaults to showing ALL projects (active + archived). IMPORTANT: Always check archived projects before creating new ones to avoid duplicates.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['active', 'archived', 'all'],
        description: 'Filter by project status. Defaults to "all" (both active and archived). Use "active" or "archived" to filter.',
      },
      company_id: {
        type: 'string',
        description: 'Filter projects by company ID',
      },
      template: {
        type: 'boolean',
        description: 'Filter by template status (true = templates only, false = non-templates only)',
      },
      limit: {
        type: 'number',
        description: 'Number of projects to return (1-200)',
        minimum: 1,
        maximum: 200,
        default: 30,
      },
    },
  },
};
