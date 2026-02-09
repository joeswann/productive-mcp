import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

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
          ...(params.body ? { body: params.body } : {}),
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

export const createDocumentDefinition = {
  name: 'create_document',
  description: 'Create a document (doc/page) in Productive.io. Documents are rich text pages that can be attached to projects. The body field accepts Productive Document Format JSON (similar to Atlassian Document Format) as a string. For plain text, just pass the text directly.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Document title (required)',
      },
      body: {
        type: 'string',
        description: 'Document body content. Can be plain text or Productive Document Format JSON string.',
      },
      project_id: {
        type: 'string',
        description: 'Project ID to attach the document to (optional)',
      },
    },
    required: ['title'],
  },
};
