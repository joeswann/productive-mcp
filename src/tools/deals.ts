import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ProductiveDealCreate, ProductiveDealUpdate } from '../api/types.js';

// --- List Project Deals ---

const listProjectDealsSchema = z.object({
  project_id: z.string().min(1, 'Project ID is required'),
  budget_type: z.number().int().min(1).max(2).optional().describe('Budget type: 1 = deal, 2 = budget'),
  limit: z.number().min(1).max(200).default(30).optional(),
});

export async function listProjectDealsTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listProjectDealsSchema.parse(args);

    const response = await client.listProjectDeals({
      project_id: params.project_id,
      budget_type: params.budget_type,
      limit: params.limit,
    });

    if (!response.data || response.data.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No deals/budgets found for this project.',
        }],
      };
    }

    const dealsText = response.data.map(deal => {
      const budgetType = deal.attributes.budget_type === 1 ? 'Deal' :
                        deal.attributes.budget_type === 2 ? 'Budget' : 'Unknown';
      const value = deal.attributes.value ? ` (Value: ${deal.attributes.value})` : '';

      return `• ${budgetType} (ID: ${deal.id})
  Name: ${deal.attributes.name}${value}`;
    }).join('\n\n');

    const typeFilter = params.budget_type === 1 ? ' deals' :
                      params.budget_type === 2 ? ' budgets' : ' deals/budgets';

    const summary = `Found ${response.data.length}${typeFilter} for project ${params.project_id}:\n\n${dealsText}`;

    return {
      content: [{
        type: 'text',
        text: summary,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const listProjectDealsDefinition = {
  name: 'list_project_deals',
  description: 'STEP 2 of timesheet workflow: Get deals/budgets for a specific project. COMPLETE WORKFLOW: 1) list_projects → 2) list_project_deals → 3) list_deal_services → 4) list_project_tasks (recommended) → 5) create_time_entry. This follows: Project → Deal/Budget → Service → Task → Time Entry.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: { type: 'string', description: 'The ID of the project (required)' },
      budget_type: { type: 'number', description: 'Filter by budget type: 1 = deal, 2 = budget', minimum: 1, maximum: 2 },
      limit: { type: 'number', description: 'Number of deals/budgets to return (1-200)', minimum: 1, maximum: 200, default: 30 },
    },
    required: ['project_id'],
  },
};

// --- Create Deal ---

const createDealSchema = z.object({
  name: z.string().min(1, 'Deal/budget name is required'),
  project_id: z.string().min(1, 'Project ID is required'),
  company_id: z.string().min(1, 'Company ID is required'),
  budget: z.boolean().default(true).optional(),
  deal_type_id: z.number().int().default(2).optional(),
  deal_status_id: z.string().optional(),
  date: z.string().optional(),
  probability: z.number().min(0).max(100).default(50).optional(),
  currency: z.string().default('NZD').optional(),
  responsible_id: z.string().optional(),
});

export async function createDealTool(
  client: ProductiveAPIClient,
  args: unknown,
  config?: { PRODUCTIVE_USER_ID?: string }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = createDealSchema.parse(args);

    let responsibleId = params.responsible_id;
    if (!responsibleId || responsibleId === 'me') {
      if (!config?.PRODUCTIVE_USER_ID) {
        throw new McpError(ErrorCode.InvalidParams, 'responsible_id is required (or set PRODUCTIVE_USER_ID to use "me")');
      }
      responsibleId = config.PRODUCTIVE_USER_ID;
    }

    const date = params.date || new Date().toISOString().split('T')[0];

    let dealStatusId = params.deal_status_id;
    if (!dealStatusId) {
      const statuses = await client.listDealStatuses({ limit: 30 });
      if (!statuses.data || statuses.data.length === 0) {
        throw new McpError(ErrorCode.InternalError, 'No deal statuses found. Please provide a deal_status_id.');
      }
      const active = statuses.data.find(s => s.attributes.status_id === 1 && !s.attributes.archived_at);
      dealStatusId = (active || statuses.data[0]).id;
    }

    const dealData: ProductiveDealCreate = {
      data: {
        type: 'deals',
        attributes: {
          name: params.name,
          date,
          deal_type_id: params.deal_type_id ?? 2,
          deal_status_id: parseInt(dealStatusId, 10),
          probability: params.probability ?? 50,
          currency: params.currency ?? 'NZD',
          budget: params.budget ?? true,
        },
        relationships: {
          company: { data: { id: params.company_id, type: 'companies' } },
          responsible: { data: { id: responsibleId, type: 'people' } },
          project: { data: { id: params.project_id, type: 'projects' } },
        },
      },
    };

    const response = await client.createDeal(dealData);
    const deal = response.data;
    const isBudget = deal.attributes.budget ? 'Budget' : 'Deal';
    return {
      content: [{
        type: 'text',
        text: `${isBudget} created successfully!\n\nName: ${deal.attributes.name}\nID: ${deal.id}\nType: ${isBudget}\nProject ID: ${params.project_id}\nCompany ID: ${params.company_id}\nResponsible ID: ${responsibleId}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const createDealDefinition = {
  name: 'create_deal',
  description: 'Create a new deal or budget for a project in Productive.io. Budgets track billable work and contain services. Defaults: budget=true, deal_type=2 (client), currency=NZD, responsible=configured user, date=today.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Deal/budget name (e.g., "[2602] Field Studies Flora: V-Day Updates - Budget")' },
      project_id: { type: 'string', description: 'ID of the project this deal/budget belongs to' },
      company_id: { type: 'string', description: 'ID of the company this deal belongs to' },
      budget: { type: 'boolean', description: 'true = budget, false = deal (default: true)', default: true },
      deal_type_id: { type: 'number', description: 'Deal type: 1=internal, 2=client (default: 2)', default: 2 },
      deal_status_id: { type: 'string', description: 'Deal status ID. Auto-detected (first active status) if not provided.' },
      date: { type: 'string', description: 'Deal date (YYYY-MM-DD). Defaults to today.' },
      probability: { type: 'number', description: 'Probability percentage (0-100, default: 50)', default: 50 },
      currency: { type: 'string', description: 'Currency code (default: NZD)', default: 'NZD' },
      responsible_id: { type: 'string', description: 'Person ID for responsible person. Defaults to configured user.' },
    },
    required: ['name', 'project_id', 'company_id'],
  },
};

// --- Update Deal ---

const updateDealSchema = z.object({
  id: z.string().min(1, 'Deal ID is required'),
  name: z.string().optional(),
  company_id: z.string().optional(),
  responsible_id: z.string().optional(),
  project_id: z.string().optional(),
  date: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  currency: z.string().optional(),
  deal_status_id: z.string().optional(),
  budget_type: z.number().int().min(1).max(2).optional().describe('1=deal, 2=budget'),
  note: z.string().optional(),
  value: z.string().optional().describe('Budget/deal value as string (e.g. "3220.0")'),
  reopen: z.boolean().optional().describe('Set to true to reopen a closed budget/deal (clears closed_at)'),
  closed_at: z.string().optional().describe('Set closed_at date (ISO 8601 datetime, e.g. "2026-02-10T00:00:00.000+13:00") to close/re-close a deal'),
});

export async function updateDealTool(
  client: ProductiveAPIClient,
  args: unknown,
  config?: { PRODUCTIVE_USER_ID?: string }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = updateDealSchema.parse(args);

    let responsibleId = params.responsible_id;
    if (responsibleId === 'me') {
      if (!config?.PRODUCTIVE_USER_ID) {
        throw new McpError(ErrorCode.InvalidParams, 'Cannot use "me" — PRODUCTIVE_USER_ID is not configured');
      }
      responsibleId = config.PRODUCTIVE_USER_ID;
    }

    const attributes: ProductiveDealUpdate['data']['attributes'] = {};
    if (params.name) attributes.name = params.name;
    if (params.date) attributes.date = params.date;
    if (params.probability !== undefined) attributes.probability = params.probability;
    if (params.currency) attributes.currency = params.currency;
    if (params.deal_status_id) attributes.deal_status_id = parseInt(params.deal_status_id, 10);
    if (params.budget_type !== undefined) attributes.budget_type = params.budget_type;
    if (params.note) attributes.note = params.note;
    if (params.value !== undefined) attributes.value = params.value;
    if (params.closed_at) attributes.closed_at = params.closed_at;
    // Use dedicated /open endpoint for reopening closed deals
    if (params.reopen) {
      try {
        await client.openDeal(params.id);
      } catch (e) {
        // /open endpoint may not exist, return error info
        return {
          content: [{ type: 'text', text: `Failed to reopen deal: ${e instanceof Error ? e.message : String(e)}` }],
        };
      }
    }

    const relationships: ProductiveDealUpdate['data']['relationships'] = {};
    if (params.company_id) relationships.company = { data: { id: params.company_id, type: 'companies' } };
    if (responsibleId) relationships.responsible = { data: { id: responsibleId, type: 'people' } };
    if (params.project_id) relationships.project = { data: { id: params.project_id, type: 'projects' } };

    const updateData: ProductiveDealUpdate = {
      data: {
        type: 'deals',
        id: params.id,
        ...(Object.keys(attributes).length > 0 && { attributes }),
        ...(Object.keys(relationships).length > 0 && { relationships }),
      },
    };

    // Only call updateDeal if there are other changes besides reopen
    const hasOtherChanges = Object.keys(attributes).length > 0 || Object.keys(relationships).length > 0;
    const response = hasOtherChanges
      ? await client.updateDeal(params.id, updateData)
      : await client.getDeal(params.id);
    const deal = response.data;

    const changes: string[] = [];
    if (params.name) changes.push(`Name: ${params.name}`);
    if (params.company_id) changes.push(`Company ID: ${params.company_id}`);
    if (responsibleId) changes.push(`Responsible ID: ${responsibleId}`);
    if (params.project_id) changes.push(`Project ID: ${params.project_id}`);
    if (params.date) changes.push(`Date: ${params.date}`);
    if (params.probability !== undefined) changes.push(`Probability: ${params.probability}%`);
    if (params.currency) changes.push(`Currency: ${params.currency}`);
    if (params.deal_status_id) changes.push(`Deal Status ID: ${params.deal_status_id}`);
    if (params.budget_type !== undefined) changes.push(`Budget Type: ${params.budget_type === 1 ? 'Deal' : 'Budget'}`);
    if (params.note) changes.push(`Note: ${params.note}`);
    if (params.value !== undefined) changes.push(`Value: ${params.value}`);
    if (params.reopen) changes.push('Reopened (cleared closed_at)');
    if (params.closed_at) changes.push(`Closed at: ${params.closed_at}`);

    return {
      content: [{
        type: 'text',
        text: `Deal ${params.id} updated successfully!\n\nCurrent name: ${deal.attributes.name}\nUpdated fields:\n${changes.map(c => `  • ${c}`).join('\n')}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const updateDealDefinition = {
  name: 'update_deal',
  description: 'Update an existing deal or budget in Productive.io. Only provide fields you want to change.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Deal/budget ID to update (required)' },
      name: { type: 'string', description: 'New deal name' },
      company_id: { type: 'string', description: 'New company ID' },
      responsible_id: { type: 'string', description: 'New responsible person ID (use "me" for configured user)' },
      project_id: { type: 'string', description: 'New project ID' },
      date: { type: 'string', description: 'New date (YYYY-MM-DD)' },
      probability: { type: 'number', description: 'New probability (0-100)', minimum: 0, maximum: 100 },
      currency: { type: 'string', description: 'New currency code' },
      deal_status_id: { type: 'string', description: 'New deal status ID' },
      budget_type: { type: 'number', description: 'Budget type: 1=deal, 2=budget', minimum: 1, maximum: 2 },
      note: { type: 'string', description: 'New note' },
      value: { type: 'string', description: 'Budget/deal value as string (e.g. "3220.0")' },
      reopen: { type: 'boolean', description: 'Set to true to reopen a closed budget/deal (clears closed_at)' },
      closed_at: { type: 'string', description: 'Set closed_at date (ISO 8601 datetime, e.g. "2026-02-10T00:00:00.000+13:00") to close/re-close a deal' },
    },
    required: ['id'],
  },
};

// --- Get Deal ---

const getDealSchema = z.object({
  id: z.string().min(1, 'Deal ID is required'),
});

export async function getDealTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = getDealSchema.parse(args);
    const response = await client.getDeal(params.id);
    const d = response.data;
    const a = d.attributes;
    const budgetType = a.budget ? 'Budget' : 'Deal';
    const projectId = d.relationships?.project?.data?.id;
    const statusId = d.relationships?.deal_status?.data?.id;

    const lines: string[] = [
      `${budgetType}: ${a.name} (ID: ${d.id})`,
      projectId ? `Project ID: ${projectId}` : '',
      a.date ? `Date: ${a.date}` : '',
      a.currency ? `Currency: ${a.currency}` : '',
      a.value ? `Value: ${a.value}` : '',
      a.total_value ? `Total Value: ${a.total_value}` : '',
      a.invoiced_amount ? `Invoiced: ${a.invoiced_amount}` : '',
      a.cost ? `Cost: ${a.cost}` : '',
      a.profit ? `Profit: ${a.profit}` : '',
      a.probability != null ? `Probability: ${a.probability}%` : '',
      statusId ? `Deal Status ID: ${statusId}` : '',
      a.delivered_on ? `Delivered: ${a.delivered_on}` : '',
      a.closed_at ? `Closed: ${a.closed_at}` : '',
      a.note ? `Note: ${a.note}` : '',
      `Created: ${a.created_at || 'Unknown'}`,
      a.updated_at ? `Updated: ${a.updated_at}` : '',
    ].filter(Boolean);

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const getDealDefinition = {
  name: 'get_deal',
  description: 'Get a single deal/budget by ID from Productive.io.',
  inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Deal/budget ID (required)' } }, required: ['id'] },
};

// --- Delete Deal ---

const deleteDealSchema = z.object({
  id: z.string().min(1, 'Deal ID is required'),
});

export async function deleteDealTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = deleteDealSchema.parse(args);
    await client.deleteDeal(params.id);
    return { content: [{ type: 'text', text: `Deal ${params.id} deleted successfully.` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const deleteDealDefinition = {
  name: 'delete_deal',
  description: 'Delete a deal/budget in Productive.io.',
  inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Deal/budget ID to delete (required)' } }, required: ['id'] },
};

// --- Copy Deal ---

const copyDealSchema = z.object({
  id: z.string().min(1, 'Source deal/budget ID is required'),
  name: z.string().optional().describe('Name for the copied deal (defaults to source name)'),
  project_id: z.string().optional().describe('Project ID to attach the copy to'),
  company_id: z.string().optional().describe('Company ID for the copy'),
});

export async function copyDealTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = copyDealSchema.parse(args || {});

    const copyData: Record<string, unknown> = {
      data: {
        type: 'deals',
        attributes: {
          template_id: parseInt(params.id, 10),
          ...(params.name && { name: params.name }),
          ...(params.company_id && { company_id: parseInt(params.company_id, 10) }),
          ...(params.project_id && { project_id: parseInt(params.project_id, 10) }),
        },
      },
    };

    const response = await client.copyDeal(copyData);
    const d = response.data;

    return {
      content: [{
        type: 'text',
        text: `Deal/budget copied successfully!\nName: ${d.attributes.name} (ID: ${d.id})\nCopied from: ${params.id}${params.project_id ? `\nProject ID: ${params.project_id}` : ''}${params.company_id ? `\nCompany ID: ${params.company_id}` : ''}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const copyDealDefinition = {
  name: 'copy_deal',
  description: 'Copy a deal/budget from an existing one (including all its services). Use this to create budgets from the budget template (3477780).',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Source deal/budget ID to copy from (required)' },
      name: { type: 'string', description: 'Name for the copied deal (optional, defaults to source name)' },
      project_id: { type: 'string', description: 'Project ID to attach the copy to' },
      company_id: { type: 'string', description: 'Company ID for the copy' },
    },
    required: ['id'],
  },
};
