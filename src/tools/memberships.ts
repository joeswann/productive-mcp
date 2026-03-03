import { z } from 'zod';
import { ProductiveAPIClient } from '../api/client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ProductiveMembershipCreate } from '../api/types.js';

// --- Add Project Member ---

const addProjectMemberSchema = z.object({
  person_id: z.string().min(1, 'Person ID is required'),
  project_id: z.string().min(1, 'Project ID is required'),
});

export async function addProjectMemberTool(
  client: ProductiveAPIClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = addProjectMemberSchema.parse(args || {});

    const membershipData: ProductiveMembershipCreate = {
      data: {
        type: 'memberships',
        attributes: {
          person_id: parseInt(params.person_id, 10),
          project_id: parseInt(params.project_id, 10),
          type_id: 1, // person
          access_type_id: 5, // member
        },
      },
    };

    const response = await client.createMembership(membershipData);
    const m = response.data;

    return {
      content: [{
        type: 'text',
        text: `Project membership created successfully!\nMembership ID: ${m.id}\nPerson ID: ${params.person_id}\nProject ID: ${params.project_id}\nAccess: member`,
      }],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`);
    }
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export const addProjectMemberDefinition = {
  name: 'add_project_member',
  description: 'Add a person as a member of a project in Productive.io. This is required for client portal access -- clients can only see projects they are explicitly added to.',
  inputSchema: {
    type: 'object',
    properties: {
      person_id: { type: 'string', description: 'ID of the person to add as a project member (required)' },
      project_id: { type: 'string', description: 'ID of the project to add them to (required)' },
    },
    required: ['person_id', 'project_id'],
  },
};
