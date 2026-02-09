import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// --- List Services ---

const listServicesSchema = z.object({
  company_id: z.string().optional(),
  limit: z.number().min(1).max(200).default(30).optional(),
});

export async function listServicesTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listServicesSchema.parse(args);

    const response = await client.listServices({
      company_id: params.company_id,
      limit: params.limit,
    });

    if (!response.data || response.data.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No services found matching the criteria.',
        }],
      };
    }

    const servicesText = response.data.map(service => {
      const companyId = service.relationships?.company?.data?.id;
      return `• ${service.attributes.name} (ID: ${service.id})
  ${companyId ? `Company ID: ${companyId}` : ''}
  ${service.attributes.description ? `Description: ${service.attributes.description}` : 'No description'}`;
    }).join('\n\n');

    const summary = `Found ${response.data.length} service${response.data.length !== 1 ? 's' : ''}${response.meta?.total_count ? ` (showing ${response.data.length} of ${response.meta.total_count})` : ''}:\n\n${servicesText}`;

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

export const listServicesDefinition = {
  name: 'list_services',
  description: 'List all services in the organization. NOTE: For timesheet entries, use the proper workflow instead: list_projects → list_project_deals → list_deal_services → create_time_entry. This tool shows all services but does not indicate which project/budget they belong to.',
  inputSchema: {
    type: 'object',
    properties: {
      company_id: {
        type: 'string',
        description: 'Filter services by company ID',
      },
      limit: {
        type: 'number',
        description: 'Number of services to return (1-200)',
        minimum: 1,
        maximum: 200,
        default: 30,
      },
    },
    required: [],
  },
};

// --- Get Project Services (deprecated) ---

const getProjectServicesSchema = z.object({
  project_id: z.string().min(1, 'Project ID is required'),
  limit: z.number().min(1).max(200).default(30).optional(),
});

export async function getProjectServicesTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = getProjectServicesSchema.parse(args);

    const response = await client.listServices({
      limit: params.limit,
    });

    if (!response.data || response.data.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No active services found for project ${params.project_id}.`,
        }],
      };
    }

    const servicesText = response.data.map(service => {
      const companyId = service.relationships?.company?.data?.id;

      return `• ${service.attributes.name} (ID: ${service.id})
  ${companyId ? `Company ID: ${companyId}` : ''}
  ${service.attributes.description ? `Description: ${service.attributes.description}` : 'No description'}`;
    }).join('\n\n');

    const summary = `Services available for project ${params.project_id} (${response.data.length} service${response.data.length !== 1 ? 's' : ''}):\n\n${servicesText}`;

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

export const getProjectServicesDefinition = {
  name: 'get_project_services',
  description: 'DEPRECATED: Use the proper workflow instead: list_projects → list_project_deals → list_deal_services → create_time_entry. This tool does not properly handle the project → deal/budget → service hierarchy required for timesheet entries.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'string',
        description: 'The ID of the project',
      },
      limit: {
        type: 'number',
        description: 'Number of services to return (1-200)',
        minimum: 1,
        maximum: 200,
        default: 30,
      },
    },
    required: ['project_id'],
  },
};

// --- List Deal Services ---

const listDealServicesSchema = z.object({
  deal_id: z.string().min(1, 'Deal/Budget ID is required'),
  limit: z.number().min(1).max(200).default(30).optional(),
});

export async function listDealServicesTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listDealServicesSchema.parse(args);

    const response = await client.listDealServices({
      deal_id: params.deal_id,
      limit: params.limit,
    });

    if (!response.data || response.data.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No services found for this deal/budget.',
        }],
      };
    }

    const billingTypes: Record<number, string> = { 1: 'Fixed', 2: 'Time & Materials', 3: 'Not Billable' };
    const unitTypes: Record<number, string> = { 1: 'Hour', 2: 'Piece', 3: 'Day' };

    const servicesText = response.data.map(service => {
      const a = service.attributes;
      const billing = a.billing_type_id ? billingTypes[a.billing_type_id] || `Type ${a.billing_type_id}` : 'Unknown';
      const unit = a.unit_id ? unitTypes[a.unit_id] || `Unit ${a.unit_id}` : '';
      const price = a.price != null ? `$${(a.price / 100).toFixed(2)}` : '';
      const billable = a.billable === true ? 'Billable' : a.billable === false ? 'Internal' : '';
      const workedTime = a.worked_time ? `Worked: ${(a.worked_time / 60).toFixed(1)}h` : '';
      const budgetedTime = a.budgeted_time ? `Budgeted: ${(a.budgeted_time / 60).toFixed(1)}h` : '';
      const revenue = a.revenue ? `Revenue: $${(a.revenue / 100).toFixed(2)}` : '';

      return `• ${a.name || 'Unnamed Service'} (ID: ${service.id}) [${billable}]
  Billing: ${billing}${unit ? ` | Unit: ${unit}` : ''}${price ? ` | Rate: ${price}` : ''}
  ${[workedTime, budgetedTime, revenue].filter(Boolean).join(' | ') || 'No time tracked'}${a.description ? `\n  Description: ${a.description}` : ''}`;
    }).join('\n\n');

    const summary = `Found ${response.data.length} service${response.data.length !== 1 ? 's' : ''} for deal/budget ${params.deal_id}:\n\n${servicesText}`;

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

export const listDealServicesDefinition = {
  name: 'list_deal_services',
  description: 'STEP 3 of timesheet workflow: Get services for a specific deal/budget. COMPLETE WORKFLOW: 1) list_projects → 2) list_project_deals → 3) list_deal_services → 4) list_project_tasks (recommended) → 5) create_time_entry. After this, optionally use list_project_tasks to find specific tasks to link your time entry to.',
  inputSchema: {
    type: 'object',
    properties: {
      deal_id: {
        type: 'string',
        description: 'The ID of the deal/budget (required)',
      },
      limit: {
        type: 'number',
        description: 'Number of services to return (1-200)',
        minimum: 1,
        maximum: 200,
        default: 30,
      },
    },
    required: ['deal_id'],
  },
};

// --- Create Service ---

const createServiceSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  deal_id: z.string().min(1, 'Deal/budget ID is required'),
  billing_type_id: z.number().int().min(1).max(3).describe('1=Fixed, 2=Time and Materials, 3=Not Billable'),
  unit_id: z.number().int().min(1).max(3).default(1).optional().describe('1=Hour, 2=Piece, 3=Day'),
  price: z.number().optional().describe('Price per unit (e.g. hourly rate)'),
  quantity: z.number().optional().describe('Estimated quantity'),
  description: z.string().optional(),
});

export async function createServiceTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = createServiceSchema.parse(args || {});

    const serviceData = {
      data: {
        type: 'services',
        attributes: {
          name: params.name,
          billing_type_id: params.billing_type_id,
          unit_id: params.unit_id ?? 1,
          ...(params.price !== undefined && { price: params.price }),
          ...(params.quantity !== undefined && { quantity: params.quantity }),
          ...(params.description && { description: params.description }),
        },
        relationships: {
          deal: {
            data: { id: params.deal_id, type: 'deals' },
          },
        },
      },
    };

    const response = await client.createService(serviceData);
    const s = response.data;

    return {
      content: [{
        type: 'text',
        text: `Service created successfully!\nName: ${s.attributes.name} (ID: ${s.id})\nDeal ID: ${params.deal_id}\nBilling: ${params.billing_type_id === 1 ? 'Fixed' : params.billing_type_id === 2 ? 'Time & Materials' : 'Not Billable'}${params.price !== undefined ? `\nPrice: $${params.price}` : ''}`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const createServiceDefinition = {
  name: 'create_service',
  description: 'Create a new service in a deal/budget. Services track billable/non-billable work categories.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Service name (e.g. "Development", "Design")' },
      deal_id: { type: 'string', description: 'Deal/budget ID to create the service in' },
      billing_type_id: { type: 'number', description: '1=Fixed, 2=Time and Materials, 3=Not Billable', minimum: 1, maximum: 3 },
      unit_id: { type: 'number', description: '1=Hour (default), 2=Piece, 3=Day', minimum: 1, maximum: 3 },
      price: { type: 'number', description: 'Price per unit (e.g. hourly rate)' },
      quantity: { type: 'number', description: 'Estimated quantity' },
      description: { type: 'string', description: 'Service description' },
    },
    required: ['name', 'deal_id', 'billing_type_id'],
  },
};
