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
  status: z.enum(['active', 'archived']).optional(),
  company_id: z.string().optional(),
  limit: z.number().min(1).max(200).default(30).optional(),
});

export async function listProjectsTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listProjectsSchema.parse(args || {});
    
    const response = await client.listProjects({
      status: params.status,
      company_id: params.company_id,
      limit: params.limit,
    });
    
    if (!response || !response.data || response.data.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No projects found matching the criteria.',
        }],
      };
    }
    
    const projectsText = response.data.filter(project => project && project.attributes).map(project => {
      const companyId = project.relationships?.company?.data?.id;
      return `• ${project.attributes.name} (ID: ${project.id})
  Status: ${project.attributes.status}
  ${companyId ? `Company ID: ${companyId}` : ''}
  ${project.attributes.description ? `Description: ${project.attributes.description}` : 'No description'}`;
    }).join('\n\n');
    
    const summary = `Found ${response.data.length} project${response.data.length !== 1 ? 's' : ''}${response.meta?.total_count ? ` (showing ${response.data.length} of ${response.meta.total_count})` : ''}:\n\n${projectsText}`;
    
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

    const updateData: ProductiveProjectUpdate = {
      data: {
        type: 'projects',
        id: params.id,
        attributes: {
          ...(params.name && { name: params.name }),
          ...(managerId && { project_manager_id: parseInt(managerId, 10) }),
          ...(params.project_type_id && { project_type_id: params.project_type_id }),
          ...(params.workflow_id && { workflow_id: parseInt(params.workflow_id, 10) }),
        },
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

    const response = await client.updateProject(params.id, updateData);
    const project = response.data;

    const changes: string[] = [];
    if (params.name) changes.push(`Name: ${params.name}`);
    if (params.company_id) changes.push(`Company ID: ${params.company_id}`);
    if (managerId) changes.push(`Project Manager ID: ${managerId}`);
    if (params.project_type_id) changes.push(`Project Type: ${params.project_type_id}`);
    if (params.workflow_id) changes.push(`Workflow ID: ${params.workflow_id}`);

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
  description: 'Delete (archive) a project in Productive.io.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Project ID to delete (required)' },
    },
    required: ['id'],
  },
};

export const listProjectsDefinition = {
  name: 'list_projects',
  description: 'Get a list of projects from Productive.io',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['active', 'archived'],
        description: 'Filter by project status',
      },
      company_id: {
        type: 'string',
        description: 'Filter projects by company ID',
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
