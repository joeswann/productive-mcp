import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const listCompaniesSchema = z.object({
  status: z.enum(['active', 'archived']).optional(),
  query: z.string().optional(),
  limit: z.number().min(1).max(200).default(30).optional(),
});

export async function listCompaniesTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listCompaniesSchema.parse(args || {});
    
    const response = await client.listCompanies({
      status: params.status,
      query: params.query,
      limit: params.limit,
    });
    
    if (!response || !response.data || response.data.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No companies found matching the criteria.',
        }],
      };
    }
    
    const companiesText = response.data.filter(company => company && company.attributes).map(company => {
      const a = company.attributes;
      const extras: string[] = [];
      if (a.domain) extras.push(`Domain: ${a.domain}`);
      if (a.billing_name) extras.push(`Billing Name: ${a.billing_name}`);
      if (a.vat) extras.push(`VAT: ${a.vat}`);
      if (a.default_currency) extras.push(`Currency: ${a.default_currency}`);
      if (a.description) extras.push(`Description: ${a.description}`);
      if (a.tag_list?.length) extras.push(`Tags: ${a.tag_list.join(', ')}`);

      return `• ${a.name} (ID: ${company.id})\n  ${extras.join('\n  ') || 'No details'}`;
    }).join('\n\n');
    
    const summary = `Found ${response.data.length} compan${response.data.length !== 1 ? 'ies' : 'y'}${response.meta?.total_count ? ` (showing ${response.data.length} of ${response.meta.total_count})` : ''}:\n\n${companiesText}`;
    
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

const getCompanySchema = z.object({
  id: z.string().min(1, 'Company ID is required'),
});

export async function getCompanyTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = getCompanySchema.parse(args);
    const response = await client.getCompany(params.id);
    const c = response.data;
    const a = c.attributes;
    const lines: string[] = [
      `Company: ${a.name} (ID: ${c.id})`,
      a.domain ? `Domain: ${a.domain}` : '',
      a.billing_name ? `Billing Name: ${a.billing_name}` : '',
      a.vat ? `VAT: ${a.vat}` : '',
      a.default_currency ? `Currency: ${a.default_currency}` : '',
      a.description ? `Description: ${a.description}` : '',
      a.tag_list?.length ? `Tags: ${a.tag_list.join(', ')}` : '',
      `Created: ${a.created_at}`,
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

export const getCompanyDefinition = {
  name: 'get_company',
  description: 'Get a single company/customer by ID from Productive.io.',
  inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Company ID (required)' } }, required: ['id'] },
};

const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  billing_name: z.string().optional(),
  vat: z.string().optional(),
  default_currency: z.string().optional(),
  description: z.string().optional(),
});

export async function createCompanyTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = createCompanySchema.parse(args);

    const response = await client.createCompany({
      data: {
        type: 'companies',
        attributes: {
          name: params.name,
          ...(params.billing_name && { billing_name: params.billing_name }),
          ...(params.vat && { vat: params.vat }),
          ...(params.default_currency && { default_currency: params.default_currency }),
          ...(params.description && { description: params.description }),
        },
      },
    });

    const c = response.data;
    const a = c.attributes;
    const lines: string[] = [
      `Company created successfully!`,
      ``,
      `Name: ${a.name} (ID: ${c.id})`,
      a.billing_name ? `Billing Name: ${a.billing_name}` : '',
      a.default_currency ? `Currency: ${a.default_currency}` : '',
      a.vat ? `VAT: ${a.vat}` : '',
      a.description ? `Description: ${a.description}` : '',
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

export const createCompanyDefinition = {
  name: 'create_company',
  description: 'Create a new company/customer in Productive.io.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Company name (required)' },
      billing_name: { type: 'string', description: 'Billing name (optional)' },
      vat: { type: 'string', description: 'VAT/tax number (optional)' },
      default_currency: { type: 'string', description: 'Default currency code, e.g. NZD, USD, GBP (optional)' },
      description: { type: 'string', description: 'Company description (optional)' },
    },
    required: ['name'],
  },
};

// --- Update Company ---

const updateCompanySchema = z.object({
  id: z.string().min(1, 'Company ID is required'),
  name: z.string().optional(),
  billing_name: z.string().nullable().optional(),
  vat: z.string().nullable().optional(),
  default_currency: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export async function updateCompanyTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = updateCompanySchema.parse(args);

    const attributes: Record<string, unknown> = {};
    if (params.name !== undefined) attributes.name = params.name;
    if (params.billing_name !== undefined) attributes.billing_name = params.billing_name;
    if (params.vat !== undefined) attributes.vat = params.vat;
    if (params.default_currency !== undefined) attributes.default_currency = params.default_currency;
    if (params.description !== undefined) attributes.description = params.description;

    if (Object.keys(attributes).length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'No fields to update. Provide at least one field.');
    }

    const response = await client.updateCompany(params.id, {
      data: {
        type: 'companies',
        attributes: attributes as { name?: string; billing_name?: string | null; vat?: string | null; default_currency?: string | null; description?: string | null },
      },
    });

    const c = response.data;
    const a = c.attributes;
    const updated = Object.keys(attributes).map(k => `  • ${k}: ${attributes[k] ?? '(cleared)'}`).join('\n');

    return {
      content: [{ type: 'text', text: `Company ${c.id} updated successfully!\n\nCurrent name: ${a.name}\nUpdated fields:\n${updated}` }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const updateCompanyDefinition = {
  name: 'update_company',
  description: 'Update a company/customer in Productive.io. Only provide fields you want to change. Set a field to null to clear it.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Company ID to update (required)' },
      name: { type: 'string', description: 'New company name' },
      billing_name: { type: ['string', 'null'], description: 'New billing name (null to clear)' },
      vat: { type: ['string', 'null'], description: 'New VAT/tax number (null to clear)' },
      default_currency: { type: ['string', 'null'], description: 'Default currency code, e.g. NZD, AUD, USD, GBP (null to clear)' },
      description: { type: ['string', 'null'], description: 'New description (null to clear)' },
    },
    required: ['id'],
  },
};

const deleteCompanySchema = z.object({
  id: z.string().min(1, 'Company ID is required'),
});

export async function deleteCompanyTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = deleteCompanySchema.parse(args);
    await client.deleteCompany(params.id);
    return { content: [{ type: 'text', text: `Company ${params.id} deleted successfully.` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const deleteCompanyDefinition = {
  name: 'delete_company',
  description: 'Delete a company/customer from Productive.io. Cannot delete companies that have associated projects or deals.',
  inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Company ID to delete (required)' } }, required: ['id'] },
};

export const listCompaniesDefinition = {
  name: 'list_companies',
  description: 'Get a list of companies/customers from Productive.io. Shows billing details, VAT, and currency.',
  inputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['active', 'archived'], description: 'Filter by company status' },
      query: { type: 'string', description: 'Text search across company names' },
      limit: { type: 'number', description: 'Number of companies to return (1-200)', minimum: 1, maximum: 200, default: 30 },
    },
  },
};
