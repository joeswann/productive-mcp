import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// ── List Prices ──

const listPricesSchema = z.object({
  rate_card_id: z.string().optional(),
  company_id: z.string().optional(),
  service_type_id: z.string().optional(),
  time_tracking_enabled: z.boolean().optional(),
  booking_tracking_enabled: z.boolean().optional(),
  expense_tracking_enabled: z.boolean().optional(),
  limit: z.number().min(1).max(200).default(30).optional(),
  page: z.number().min(1).optional(),
});

export async function listPricesTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listPricesSchema.parse(args || {});
    const response = await client.listPrices(params);

    if (!response.data || response.data.length === 0) {
      return { content: [{ type: 'text', text: 'No prices found.' }] };
    }

    const includedMap = new Map<string, Record<string, unknown>>();
    if (response.included) {
      for (const inc of response.included) {
        includedMap.set(`${inc.type}:${inc.id}`, inc.attributes);
      }
    }

    const items = response.data.map(p => {
      const a = p.attributes;
      const rateCardId = p.relationships?.rate_card?.data?.id;
      const companyId = p.relationships?.company?.data?.id;
      const serviceTypeId = p.relationships?.service_type?.data?.id;
      const rateCardName = rateCardId ? includedMap.get(`rate_cards:${rateCardId}`)?.name : undefined;
      const companyName = companyId ? includedMap.get(`companies:${companyId}`)?.name : undefined;
      const serviceTypeName = serviceTypeId ? includedMap.get(`service_types:${serviceTypeId}`)?.name : undefined;

      let line = `• ${a.name} (ID: ${p.id})`;
      if (a.rate !== undefined && a.currency) line += `\n  Rate: $${(Number(a.rate) / 100).toFixed(2)} ${a.currency}`;
      if (serviceTypeName) line += `\n  Service Type: ${serviceTypeName}`;
      if (rateCardName) line += `\n  Rate Card: ${rateCardName}`;
      if (companyName) line += `\n  Company: ${companyName}`;

      const flags = [];
      if (a.time_tracking_enabled) flags.push('Time');
      if (a.booking_tracking_enabled) flags.push('Booking');
      if (a.expense_tracking_enabled) flags.push('Expense');
      if (flags.length > 0) line += `\n  Tracking: ${flags.join(', ')}`;

      return line;
    }).join('\n\n');

    const total = response.meta?.total_count;
    const summary = `Found ${response.data.length} price${response.data.length !== 1 ? 's' : ''}${total ? ` (showing ${response.data.length} of ${total})` : ''}:\n\n${items}`;
    return { content: [{ type: 'text', text: summary }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const listPricesDefinition = {
  name: 'list_prices',
  description: 'List prices (rate entries on rate cards). Rates are in cents — 14000 = $140.00/hr.',
  inputSchema: {
    type: 'object',
    properties: {
      rate_card_id: { type: 'string', description: 'Filter by rate card ID' },
      company_id: { type: 'string', description: 'Filter by company ID' },
      service_type_id: { type: 'string', description: 'Filter by service type ID' },
      time_tracking_enabled: { type: 'boolean', description: 'Filter by time tracking enabled' },
      booking_tracking_enabled: { type: 'boolean', description: 'Filter by booking tracking enabled' },
      expense_tracking_enabled: { type: 'boolean', description: 'Filter by expense tracking enabled' },
      limit: { type: 'number', description: 'Results per page (1-200, default 30)', minimum: 1, maximum: 200 },
      page: { type: 'number', description: 'Page number', minimum: 1 },
    },
  },
};

// ── Get Price ──

const getPriceSchema = z.object({
  price_id: z.string(),
});

export async function getPriceTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { price_id } = getPriceSchema.parse(args);
    const response = await client.getPrice(price_id);
    const p = response.data;
    const a = p.attributes;

    const includedMap = new Map<string, Record<string, unknown>>();
    if (response.included) {
      for (const inc of response.included) {
        includedMap.set(`${inc.type}:${inc.id}`, inc.attributes);
      }
    }

    const rateCardId = p.relationships?.rate_card?.data?.id;
    const companyId = p.relationships?.company?.data?.id;
    const serviceTypeId = p.relationships?.service_type?.data?.id;

    let text = `Price: ${a.name} (ID: ${p.id})`;
    if (a.rate !== undefined && a.currency) text += `\nRate: $${(Number(a.rate) / 100).toFixed(2)} ${a.currency}`;
    if (a.quantity) text += `\nQuantity: ${a.quantity}`;
    if (a.description) text += `\nDescription: ${a.description}`;
    if (serviceTypeId) {
      const name = includedMap.get(`service_types:${serviceTypeId}`)?.name;
      text += `\nService Type: ${name || `ID ${serviceTypeId}`}`;
    }
    if (rateCardId) {
      const name = includedMap.get(`rate_cards:${rateCardId}`)?.name;
      text += `\nRate Card: ${name || `ID ${rateCardId}`}`;
    }
    if (companyId) {
      const name = includedMap.get(`companies:${companyId}`)?.name;
      text += `\nCompany: ${name || `ID ${companyId}`}`;
    }

    const flags = [];
    if (a.time_tracking_enabled) flags.push('Time');
    if (a.booking_tracking_enabled) flags.push('Booking');
    if (a.expense_tracking_enabled) flags.push('Expense');
    if (flags.length > 0) text += `\nTracking: ${flags.join(', ')}`;

    return { content: [{ type: 'text', text }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const getPriceDefinition = {
  name: 'get_price',
  description: 'Get a single price by ID.',
  inputSchema: {
    type: 'object',
    properties: {
      price_id: { type: 'string', description: 'Price ID' },
    },
    required: ['price_id'],
  },
};

// ── Create Price ──

const createPriceSchema = z.object({
  name: z.string(),
  unit_id: z.number(),
  rate: z.number().describe('Rate in cents (14000 = $140.00/hr)'),
  currency: z.string(),
  company_id: z.string(),
  service_type_id: z.string(),
  rate_card_id: z.string(),
  quantity: z.number().optional(),
  billing_type_id: z.number().optional(),
  description: z.string().optional(),
  time_tracking_enabled: z.boolean().optional(),
  booking_tracking_enabled: z.boolean().optional(),
  expense_tracking_enabled: z.boolean().optional(),
});

export async function createPriceTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = createPriceSchema.parse(args);
    const response = await client.createPrice({
      data: {
        type: 'prices',
        attributes: {
          name: params.name,
          unit_id: params.unit_id,
          rate: params.rate,
          currency: params.currency,
          quantity: params.quantity,
          billing_type_id: params.billing_type_id,
          description: params.description,
          time_tracking_enabled: params.time_tracking_enabled,
          booking_tracking_enabled: params.booking_tracking_enabled,
          expense_tracking_enabled: params.expense_tracking_enabled,
        },
        relationships: {
          company: { data: { id: params.company_id, type: 'companies' } },
          service_type: { data: { id: params.service_type_id, type: 'service_types' } },
          rate_card: { data: { id: params.rate_card_id, type: 'rate_cards' } },
        },
      },
    });

    const p = response.data;
    return { content: [{ type: 'text', text: `Created price "${p.attributes.name}" at $${(Number(p.attributes.rate) / 100).toFixed(2)} ${p.attributes.currency} (ID: ${p.id})` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const createPriceDefinition = {
  name: 'create_price',
  description: 'Create a new price on a rate card. Rate is in cents (14000 = $140.00/hr).',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Price name' },
      unit_id: { type: 'number', description: 'Unit ID (1=Hour, 2=Piece, 3=Day)' },
      rate: { type: 'number', description: 'Rate in cents (14000 = $140.00/hr)' },
      currency: { type: 'string', description: 'Currency code (e.g. NZD, USD)' },
      company_id: { type: 'string', description: 'Company ID' },
      service_type_id: { type: 'string', description: 'Service type ID' },
      rate_card_id: { type: 'string', description: 'Rate card ID' },
      quantity: { type: 'number', description: 'Quantity' },
      billing_type_id: { type: 'number', description: 'Billing type (1=Fixed, 2=Time & Materials, 3=Not Billable)' },
      description: { type: 'string', description: 'Description' },
      time_tracking_enabled: { type: 'boolean', description: 'Enable time tracking' },
      booking_tracking_enabled: { type: 'boolean', description: 'Enable booking tracking' },
      expense_tracking_enabled: { type: 'boolean', description: 'Enable expense tracking' },
    },
    required: ['name', 'unit_id', 'rate', 'currency', 'company_id', 'service_type_id', 'rate_card_id'],
  },
};

// ── Update Price ──

const updatePriceSchema = z.object({
  price_id: z.string(),
  name: z.string().optional(),
  rate: z.number().optional(),
  currency: z.string().optional(),
  quantity: z.number().optional(),
  billing_type_id: z.number().optional(),
  description: z.string().optional(),
  time_tracking_enabled: z.boolean().optional(),
  booking_tracking_enabled: z.boolean().optional(),
  expense_tracking_enabled: z.boolean().optional(),
});

export async function updatePriceTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = updatePriceSchema.parse(args);
    const attributes: Record<string, unknown> = {};
    if (params.name !== undefined) attributes.name = params.name;
    if (params.rate !== undefined) attributes.rate = params.rate;
    if (params.currency !== undefined) attributes.currency = params.currency;
    if (params.quantity !== undefined) attributes.quantity = params.quantity;
    if (params.billing_type_id !== undefined) attributes.billing_type_id = params.billing_type_id;
    if (params.description !== undefined) attributes.description = params.description;
    if (params.time_tracking_enabled !== undefined) attributes.time_tracking_enabled = params.time_tracking_enabled;
    if (params.booking_tracking_enabled !== undefined) attributes.booking_tracking_enabled = params.booking_tracking_enabled;
    if (params.expense_tracking_enabled !== undefined) attributes.expense_tracking_enabled = params.expense_tracking_enabled;

    const response = await client.updatePrice(params.price_id, {
      data: {
        type: 'prices',
        id: params.price_id,
        attributes: attributes as { name?: string; rate?: number; currency?: string },
      },
    });

    const p = response.data;
    return { content: [{ type: 'text', text: `Updated price "${p.attributes.name}" (ID: ${p.id})` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const updatePriceDefinition = {
  name: 'update_price',
  description: 'Update a price. Rate is in cents (14000 = $140.00/hr).',
  inputSchema: {
    type: 'object',
    properties: {
      price_id: { type: 'string', description: 'Price ID' },
      name: { type: 'string', description: 'New name' },
      rate: { type: 'number', description: 'New rate in cents' },
      currency: { type: 'string', description: 'New currency code' },
      quantity: { type: 'number', description: 'New quantity' },
      billing_type_id: { type: 'number', description: 'New billing type' },
      description: { type: 'string', description: 'New description' },
      time_tracking_enabled: { type: 'boolean', description: 'Enable/disable time tracking' },
      booking_tracking_enabled: { type: 'boolean', description: 'Enable/disable booking tracking' },
      expense_tracking_enabled: { type: 'boolean', description: 'Enable/disable expense tracking' },
    },
    required: ['price_id'],
  },
};

// ── Delete Price ──

const deletePriceSchema = z.object({
  price_id: z.string(),
});

export async function deletePriceTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { price_id } = deletePriceSchema.parse(args);
    await client.deletePrice(price_id);
    return { content: [{ type: 'text', text: `Deleted price ${price_id}` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const deletePriceDefinition = {
  name: 'delete_price',
  description: 'Delete a price.',
  inputSchema: {
    type: 'object',
    properties: {
      price_id: { type: 'string', description: 'Price ID' },
    },
    required: ['price_id'],
  },
};
