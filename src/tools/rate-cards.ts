import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// ── List Rate Cards ──

const listRateCardsSchema = z.object({
  company_id: z.string().optional(),
  limit: z.number().min(1).max(200).default(30).optional(),
  page: z.number().min(1).optional(),
});

export async function listRateCardsTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listRateCardsSchema.parse(args || {});
    const response = await client.listRateCards(params);

    if (!response.data || response.data.length === 0) {
      return { content: [{ type: 'text', text: 'No rate cards found.' }] };
    }

    const companyMap = new Map<string, string>();
    if (response.included) {
      for (const inc of response.included) {
        if (inc.type === 'companies') companyMap.set(inc.id, String(inc.attributes?.name || ''));
      }
    }

    const items = response.data.map(rc => {
      const a = rc.attributes;
      const companyId = rc.relationships?.company?.data?.id;
      const companyName = companyId ? companyMap.get(companyId) : undefined;
      const archived = a.archived_at ? ' [ARCHIVED]' : '';

      let line = `• ${a.name}${archived} (ID: ${rc.id})`;
      if (companyName) line += `\n  Company: ${companyName}`;
      if (a.prices_count !== undefined) line += `\n  Prices: ${a.prices_count}`;
      return line;
    }).join('\n\n');

    const total = response.meta?.total_count;
    const summary = `Found ${response.data.length} rate card${response.data.length !== 1 ? 's' : ''}${total ? ` (showing ${response.data.length} of ${total})` : ''}:\n\n${items}`;
    return { content: [{ type: 'text', text: summary }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const listRateCardsDefinition = {
  name: 'list_rate_cards',
  description: 'List rate cards, optionally filtered by company.',
  inputSchema: {
    type: 'object',
    properties: {
      company_id: { type: 'string', description: 'Filter by company ID' },
      limit: { type: 'number', description: 'Results per page (1-200, default 30)', minimum: 1, maximum: 200 },
      page: { type: 'number', description: 'Page number', minimum: 1 },
    },
  },
};

// ── Get Rate Card ──

const getRateCardSchema = z.object({
  rate_card_id: z.string(),
});

export async function getRateCardTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { rate_card_id } = getRateCardSchema.parse(args);
    const response = await client.getRateCard(rate_card_id, { include: 'company' });
    const rc = response.data;
    const a = rc.attributes;

    const companyId = rc.relationships?.company?.data?.id;
    let companyName: string | undefined;
    if (companyId && response.included) {
      const comp = response.included.find(i => i.type === 'companies' && i.id === companyId);
      companyName = comp ? String(comp.attributes?.name || '') : undefined;
    }

    const archived = a.archived_at ? ' [ARCHIVED]' : '';
    let text = `Rate Card: ${a.name}${archived} (ID: ${rc.id})`;
    if (companyName) text += `\nCompany: ${companyName}`;
    if (a.prices_count !== undefined) text += `\nPrices: ${a.prices_count}`;
    text += `\nCreated: ${a.created_at}`;
    text += `\nUpdated: ${a.updated_at}`;

    return { content: [{ type: 'text', text }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const getRateCardDefinition = {
  name: 'get_rate_card',
  description: 'Get a single rate card by ID.',
  inputSchema: {
    type: 'object',
    properties: {
      rate_card_id: { type: 'string', description: 'Rate card ID' },
    },
    required: ['rate_card_id'],
  },
};

// ── Create Rate Card ──

const createRateCardSchema = z.object({
  name: z.string(),
  company_id: z.string(),
});

export async function createRateCardTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = createRateCardSchema.parse(args);
    const response = await client.createRateCard({
      data: {
        type: 'rate_cards',
        attributes: { name: params.name },
        relationships: {
          company: { data: { id: params.company_id, type: 'companies' } },
        },
      },
    });

    const rc = response.data;
    return { content: [{ type: 'text', text: `Created rate card "${rc.attributes.name}" (ID: ${rc.id})` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const createRateCardDefinition = {
  name: 'create_rate_card',
  description: 'Create a new rate card for a company.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Rate card name' },
      company_id: { type: 'string', description: 'Company ID' },
    },
    required: ['name', 'company_id'],
  },
};

// ── Update Rate Card ──

const updateRateCardSchema = z.object({
  rate_card_id: z.string(),
  name: z.string().optional(),
});

export async function updateRateCardTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = updateRateCardSchema.parse(args);
    const attributes: Record<string, unknown> = {};
    if (params.name !== undefined) attributes.name = params.name;

    const response = await client.updateRateCard(params.rate_card_id, {
      data: { type: 'rate_cards', id: params.rate_card_id, attributes: attributes as { name?: string } },
    });

    const rc = response.data;
    return { content: [{ type: 'text', text: `Updated rate card "${rc.attributes.name}" (ID: ${rc.id})` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const updateRateCardDefinition = {
  name: 'update_rate_card',
  description: 'Update a rate card name.',
  inputSchema: {
    type: 'object',
    properties: {
      rate_card_id: { type: 'string', description: 'Rate card ID' },
      name: { type: 'string', description: 'New name' },
    },
    required: ['rate_card_id'],
  },
};

// ── Delete Rate Card ──

const deleteRateCardSchema = z.object({
  rate_card_id: z.string(),
});

export async function deleteRateCardTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { rate_card_id } = deleteRateCardSchema.parse(args);
    await client.deleteRateCard(rate_card_id);
    return { content: [{ type: 'text', text: `Deleted rate card ${rate_card_id}` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const deleteRateCardDefinition = {
  name: 'delete_rate_card',
  description: 'Delete a rate card.',
  inputSchema: {
    type: 'object',
    properties: {
      rate_card_id: { type: 'string', description: 'Rate card ID' },
    },
    required: ['rate_card_id'],
  },
};

// ── Archive Rate Card ──

const archiveRateCardSchema = z.object({
  rate_card_id: z.string(),
});

export async function archiveRateCardTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { rate_card_id } = archiveRateCardSchema.parse(args);
    const response = await client.archiveRateCard(rate_card_id);
    return { content: [{ type: 'text', text: `Archived rate card "${response.data.attributes.name}" (ID: ${rate_card_id})` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const archiveRateCardDefinition = {
  name: 'archive_rate_card',
  description: 'Archive a rate card.',
  inputSchema: {
    type: 'object',
    properties: {
      rate_card_id: { type: 'string', description: 'Rate card ID' },
    },
    required: ['rate_card_id'],
  },
};

// ── Restore Rate Card ──

const restoreRateCardSchema = z.object({
  rate_card_id: z.string(),
});

export async function restoreRateCardTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { rate_card_id } = restoreRateCardSchema.parse(args);
    const response = await client.restoreRateCard(rate_card_id);
    return { content: [{ type: 'text', text: `Restored rate card "${response.data.attributes.name}" (ID: ${rate_card_id})` }] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const restoreRateCardDefinition = {
  name: 'restore_rate_card',
  description: 'Restore an archived rate card.',
  inputSchema: {
    type: 'object',
    properties: {
      rate_card_id: { type: 'string', description: 'Rate card ID' },
    },
    required: ['rate_card_id'],
  },
};
