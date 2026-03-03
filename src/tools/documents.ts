import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Prepare body for the Productive API.
 * The API expects body as a string — either plain text or a JSON-encoded
 * Productive Document Format string. We pass through as-is since the caller
 * provides the correct format.
 */
function prepareBody(body: string): string {
  return body;
}

const createDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().optional(),
  project_id: z.string().optional(),
});

export async function createDocumentTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = createDocumentSchema.parse(args);

    const pageData: Record<string, unknown> = {
      data: {
        type: 'pages',
        attributes: {
          title: params.title,
          ...(params.body ? { body: prepareBody(params.body) } : {}),
        },
        ...(params.project_id ? {
          relationships: {
            project: {
              data: {
                id: params.project_id,
                type: 'projects',
              },
            },
          },
        } : {}),
      },
    };

    const response = await client.createPage(pageData as any);

    let text = `Document created successfully!\n`;
    text += `Title: ${response.data.attributes.title}\n`;
    text += `ID: ${response.data.id}`;
    if (response.data.attributes.created_at) {
      text += `\nCreated at: ${response.data.attributes.created_at}`;
    }

    return {
      content: [{
        type: 'text',
        text,
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

const updateDocumentSchema = z.object({
  document_id: z.string().min(1, 'Document ID is required'),
  title: z.string().optional(),
  body: z.string().optional(),
});

export async function updateDocumentTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = updateDocumentSchema.parse(args);

    const attributes: Record<string, unknown> = {};
    if (params.title) attributes.title = params.title;
    if (params.body) attributes.body = prepareBody(params.body);

    const pageData = {
      data: {
        type: 'pages' as const,
        id: params.document_id,
        attributes,
      },
    };

    const response = await client.updatePage(params.document_id, pageData as any);

    let text = `Document updated successfully!\n`;
    text += `Title: ${response.data.attributes.title}\n`;
    text += `ID: ${response.data.id}`;

    return {
      content: [{ type: 'text', text }],
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

const deleteDocumentSchema = z.object({
  document_id: z.string().min(1, 'Document ID is required'),
});

export async function deleteDocumentTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = deleteDocumentSchema.parse(args);

    await client.deletePage(params.document_id);

    return {
      content: [{
        type: 'text',
        text: `Document ${params.document_id} deleted successfully.`,
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

const listDocumentsSchema = z.object({
  project_id: z.string().optional(),
  limit: z.number().min(1).max(200).default(30).optional(),
});

export async function listDocumentsTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = listDocumentsSchema.parse(args || {});

    const response = await client.listPages({
      project_id: params.project_id,
      limit: params.limit,
    });

    const pages = response?.data || [];
    if (pages.length === 0) {
      return {
        content: [{ type: 'text', text: 'No documents found.' }],
      };
    }

    const pagesText = pages
      .filter(p => p && p.attributes)
      .map(p => {
        const title = p.attributes.title || '(untitled)';
        const created = p.attributes.created_at || '';
        return `• ${title} (ID: ${p.id})${created ? `\n  Created: ${created}` : ''}`;
      })
      .join('\n\n');

    return {
      content: [{
        type: 'text',
        text: `Found ${pages.length} document${pages.length !== 1 ? 's' : ''}:\n\n${pagesText}`,
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

const getDocumentSchema = z.object({
  document_id: z.string().min(1, 'Document ID is required'),
});

export async function getDocumentTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = getDocumentSchema.parse(args);
    const response = await client.getPage(params.document_id);
    const page = response.data;

    let text = `Title: ${page.attributes.title}\n`;
    text += `ID: ${page.id}\n`;
    if (page.attributes.created_at) {
      text += `Created: ${page.attributes.created_at}\n`;
    }
    if (page.attributes.updated_at) {
      text += `Updated: ${page.attributes.updated_at}\n`;
    }
    text += `\n--- Body ---\n`;
    text += page.attributes.body || '(empty)';

    return {
      content: [{ type: 'text', text }],
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

export const getDocumentDefinition = {
  name: 'get_document',
  description: 'Get a single document (doc/page) from Productive.io by ID. Returns the full document including body content.',
  inputSchema: {
    type: 'object',
    properties: {
      document_id: {
        type: 'string',
        description: 'ID of the document to retrieve (required)',
      },
    },
    required: ['document_id'],
  },
};

export const listDocumentsDefinition = {
  name: 'list_documents',
  description: 'List documents (pages) in Productive.io. Can filter by project.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'string',
        description: 'Filter documents by project ID',
      },
      limit: {
        type: 'number',
        description: 'Number of documents to return (1-200, default: 30)',
        minimum: 1,
        maximum: 200,
        default: 30,
      },
    },
  },
};

export const createDocumentDefinition = {
  name: 'create_document',
  description: 'Create a document (doc/page) in Productive.io. Documents are rich text pages that can be attached to projects. The body field accepts Productive Document Format JSON (similar to Atlassian Document Format) as a string. For plain text, just pass the text directly — it will be auto-wrapped in the correct format.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Document title (required)',
      },
      body: {
        type: 'string',
        description: 'Document body content. Can be plain text or Productive Document Format JSON string (ADF-like: {"type":"doc","content":[...]}). Plain text is auto-wrapped.',
      },
      project_id: {
        type: 'string',
        description: 'Project ID to attach the document to (optional)',
      },
    },
    required: ['title'],
  },
};

export const updateDocumentDefinition = {
  name: 'update_document',
  description: 'Update an existing document (doc/page) in Productive.io. Can update title, body, or both.',
  inputSchema: {
    type: 'object',
    properties: {
      document_id: {
        type: 'string',
        description: 'ID of the document to update (required)',
      },
      title: {
        type: 'string',
        description: 'New document title',
      },
      body: {
        type: 'string',
        description: 'New body content. Can be plain text or Productive Document Format JSON string. Plain text is auto-wrapped.',
      },
    },
    required: ['document_id'],
  },
};

export const deleteDocumentDefinition = {
  name: 'delete_document',
  description: 'Delete a document (doc/page) from Productive.io. This is permanent.',
  inputSchema: {
    type: 'object',
    properties: {
      document_id: {
        type: 'string',
        description: 'ID of the document to delete (required)',
      },
    },
    required: ['document_id'],
  },
};
