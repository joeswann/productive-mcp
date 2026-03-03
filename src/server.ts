import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getConfig } from './config/index.js';
import { ProductiveAPIClient } from './api/client.js';
import { listProjectsTool, createProjectTool, updateProjectTool, getProjectTool, deleteProjectTool, copyProjectTool, listProjectsDefinition, createProjectDefinition, updateProjectDefinition, getProjectDefinition, deleteProjectDefinition, copyProjectDefinition } from './tools/projects.js';
import { listTasksTool, getProjectTasksTool, getTaskTool, createTaskTool, updateTaskAssignmentTool, updateTaskDetailsTool, deleteTaskTool, listTasksDefinition, getProjectTasksDefinition, getTaskDefinition, createTaskDefinition, updateTaskAssignmentDefinition, updateTaskDetailsDefinition, deleteTaskDefinition } from './tools/tasks.js';
import { listCompaniesTool, getCompanyTool, createCompanyTool, updateCompanyTool, deleteCompanyTool, listCompaniesDefinition, getCompanyDefinition, createCompanyDefinition, updateCompanyDefinition, deleteCompanyDefinition } from './tools/companies.js';
import { myTasksTool, myTasksDefinition } from './tools/my-tasks.js';
import { listBoards, createBoard, updateBoard, getBoard, deleteBoard, listBoardsTool, createBoardTool, updateBoardTool, getBoardTool, deleteBoardTool } from './tools/boards.js';
import { listTaskLists, createTaskList, updateTaskList, getTaskList, deleteTaskList, listTaskListsTool, createTaskListTool, updateTaskListTool, getTaskListTool, deleteTaskListTool } from './tools/task-lists.js';
import { whoAmI, whoAmITool } from './tools/whoami.js';
import { listActivities, listActivitiesTool } from './tools/activities.js';
import { getRecentUpdates, getRecentUpdatesTool } from './tools/recent-updates.js';
import { addTaskCommentTool, addTaskCommentDefinition, deleteTaskCommentTool, deleteTaskCommentDefinition, listCommentsTool, listCommentsDefinition } from './tools/comments.js';
import { listDocumentsTool, listDocumentsDefinition, getDocumentTool, getDocumentDefinition, createDocumentTool, createDocumentDefinition, updateDocumentTool, updateDocumentDefinition, deleteDocumentTool, deleteDocumentDefinition } from './tools/documents.js';
import { updateTaskStatusTool, updateTaskStatusDefinition } from './tools/task-status.js';
import { listWorkflowStatusesTool, listWorkflowStatusesDefinition } from './tools/workflow-statuses.js';
import { listTimeEntriesTool, createTimeEntryTool, updateTimeEntryTool, deleteTimeEntryTool, listTimeEntriesDefinition, createTimeEntryDefinition, updateTimeEntryDefinition, deleteTimeEntryDefinition } from './tools/time-entries.js';
import { listProjectDealsTool, createDealTool, updateDealTool, getDealTool, deleteDealTool, copyDealTool, listProjectDealsDefinition, createDealDefinition, updateDealDefinition, getDealDefinition, deleteDealDefinition, copyDealDefinition } from './tools/deals.js';
import { listServicesTool, listDealServicesTool, createServiceTool, updateServiceTool, listServicesDefinition, listDealServicesDefinition, createServiceDefinition, updateServiceDefinition } from './tools/services.js';
import { updateTaskSprint, updateTaskSprintTool } from './tools/task-sprint.js';
import { moveTaskToList, moveTaskToListTool } from './tools/task-list-move.js';
import { addToBacklog, addToBacklogTool } from './tools/task-backlog.js';
import { taskRepositionTool, taskRepositionDefinition, taskRepositionSchema } from './tools/task-reposition.js';
import { listTaxRatesTool, listTaxRatesDefinition, listDocumentTypesTool, listDocumentTypesDefinition, listInvoicesTool, listInvoicesDefinition, getInvoiceTool, getInvoiceDefinition, deleteInvoiceTool, deleteInvoiceDefinition, createInvoiceTool, createInvoiceDefinition, updateInvoiceTool, updateInvoiceDefinition, linkInvoiceToBudgetTool, linkInvoiceToBudgetDefinition, createLineItemTool, createLineItemDefinition, finalizeInvoiceTool, finalizeInvoiceDefinition, listPaymentsTool, listPaymentsDefinition, deletePaymentTool, deletePaymentDefinition, listInvoiceAttributionsTool, listInvoiceAttributionsDefinition, deleteInvoiceAttributionTool, deleteInvoiceAttributionDefinition } from './tools/invoices.js';
import { listExpensesTool, listExpensesDefinition, createExpenseTool, createExpenseDefinition, deleteExpenseTool, deleteExpenseDefinition } from './tools/expenses.js';
import { listRateCardsTool, listRateCardsDefinition, getRateCardTool, getRateCardDefinition, createRateCardTool, createRateCardDefinition, updateRateCardTool, updateRateCardDefinition, deleteRateCardTool, deleteRateCardDefinition, archiveRateCardTool, archiveRateCardDefinition, restoreRateCardTool, restoreRateCardDefinition } from './tools/rate-cards.js';
import { listPricesTool, listPricesDefinition, getPriceTool, getPriceDefinition, createPriceTool, createPriceDefinition, updatePriceTool, updatePriceDefinition, deletePriceTool, deletePriceDefinition } from './tools/prices.js';
import { listTodosTool, listTodosDefinition, createTodoTool, createTodoDefinition, updateTodoTool, updateTodoDefinition, deleteTodoTool, deleteTodoDefinition } from './tools/todos.js';
import { listBookingsTool, listBookingsDefinition, getBookingTool, getBookingDefinition, createBookingTool, createBookingDefinition, updateBookingTool, updateBookingDefinition, deleteBookingTool, deleteBookingDefinition } from './tools/bookings.js';
import { getReportTool, getReportDefinition } from './tools/reports.js';
import { listPeopleTool, listPeopleDefinition, getPersonTool, getPersonDefinition, createPersonTool, createPersonDefinition, updatePersonTool, updatePersonDefinition, listCustomRolesTool, listCustomRolesDefinition, invitePersonTool, invitePersonDefinition, setCostRateTool, setCostRateDefinition, listCostRatesTool, listCostRatesDefinition, updateCostRateTool, updateCostRateDefinition } from './tools/people.js';
import { addProjectMemberTool, addProjectMemberDefinition } from './tools/memberships.js';
import { generateTimesheetPrompt, timesheetPromptDefinition, generateQuickTimesheetPrompt, quickTimesheetPromptDefinition } from './prompts/timesheet.js';

export async function createServer() {
  // Initialize API client and config early to check user context
  const config = getConfig();
  const hasConfiguredUser = !!config.PRODUCTIVE_USER_ID;

  const server = new Server(
    {
      name: 'productive-mcp',
      version: '1.0.0',
      description: `MCP server for Productive.io API integration. Productive has a hierarchical structure: Customers → Projects → Boards → Task Lists → Tasks. Time tracking: Project → Deal/Budget → Service → Time Entry. Invoicing: 1) create_invoice (creates draft, $0) → 2) create_line_item (adds amounts + tax) → 3) link_invoice_to_budget (connects to deal/budget) → 4) finalize_invoice (one-way, locks invoice and auto-assigns number). Invoice amounts come from line items, NOT from the invoice itself. The attribution amount must match the invoice total for Productive to show it as correctly distributed. Use xero_invoice_url on create/update to link to Xero.${hasConfiguredUser ? ` IMPORTANT: When users say "me" or "assign to me", use "me" as the assignee_id value - it automatically resolves to the configured user ID ${config.PRODUCTIVE_USER_ID}.` : ' No user configured - set PRODUCTIVE_USER_ID to enable "me" context.'} Use the 'whoami' tool to check current user context.`,
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  );
  const apiClient = new ProductiveAPIClient(config);

  // Register handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      whoAmITool,
      listCompaniesDefinition,
      getCompanyDefinition,
      createCompanyDefinition,
      updateCompanyDefinition,
      deleteCompanyDefinition,
      listProjectsDefinition,
      getProjectDefinition,
      createProjectDefinition,
      updateProjectDefinition,
      deleteProjectDefinition,
      copyProjectDefinition,
      listBoardsTool,
      getBoardTool,
      createBoardTool,
      updateBoardTool,
      deleteBoardTool,
      listTaskListsTool,
      getTaskListTool,
      createTaskListTool,
      updateTaskListTool,
      deleteTaskListTool,
      listTasksDefinition,
      getProjectTasksDefinition,
      getTaskDefinition,
      createTaskDefinition,
      updateTaskAssignmentDefinition,
      updateTaskDetailsDefinition,
      deleteTaskDefinition,
      addTaskCommentDefinition,
      listCommentsDefinition,
      updateTaskStatusDefinition,
      listWorkflowStatusesDefinition,
      myTasksDefinition,
      listActivitiesTool,
      getRecentUpdatesTool,
      listTimeEntriesDefinition,
      createTimeEntryDefinition,
      updateTimeEntryDefinition,
      deleteTimeEntryDefinition,
      listProjectDealsDefinition,
      listDealServicesDefinition,
      getDealDefinition,
      createDealDefinition,
      updateDealDefinition,
      deleteDealDefinition,
      copyDealDefinition,
      listServicesDefinition,
      createServiceDefinition,
      updateServiceDefinition,
      updateTaskSprintTool,
      moveTaskToListTool,
      addToBacklogTool,
      taskRepositionDefinition,
      listTaxRatesDefinition,
      listDocumentTypesDefinition,
      listInvoicesDefinition,
      getInvoiceDefinition,
      deleteInvoiceDefinition,
      createInvoiceDefinition,
      updateInvoiceDefinition,
      linkInvoiceToBudgetDefinition,
      createLineItemDefinition,
      finalizeInvoiceDefinition,
      listPaymentsDefinition,
      deletePaymentDefinition,
      listInvoiceAttributionsDefinition,
      deleteInvoiceAttributionDefinition,
      deleteTaskCommentDefinition,
      listDocumentsDefinition,
      getDocumentDefinition,
      createDocumentDefinition,
      updateDocumentDefinition,
      deleteDocumentDefinition,
      listExpensesDefinition,
      createExpenseDefinition,
      deleteExpenseDefinition,
      listRateCardsDefinition,
      getRateCardDefinition,
      createRateCardDefinition,
      updateRateCardDefinition,
      deleteRateCardDefinition,
      archiveRateCardDefinition,
      restoreRateCardDefinition,
      listPricesDefinition,
      getPriceDefinition,
      createPriceDefinition,
      updatePriceDefinition,
      deletePriceDefinition,
      listTodosDefinition,
      createTodoDefinition,
      updateTodoDefinition,
      deleteTodoDefinition,
      listBookingsDefinition,
      getBookingDefinition,
      createBookingDefinition,
      updateBookingDefinition,
      deleteBookingDefinition,
      getReportDefinition,
      listPeopleDefinition,
      getPersonDefinition,
      createPersonDefinition,
      updatePersonDefinition,
      listCustomRolesDefinition,
      invitePersonDefinition,
      setCostRateDefinition,
      listCostRatesDefinition,
      updateCostRateDefinition,
      addProjectMemberDefinition,
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'whoami':
        return await whoAmI(apiClient, args, config);

      case 'list_companies':
        return await listCompaniesTool(apiClient, args);

      case 'get_company':
        return await getCompanyTool(apiClient, args);

      case 'create_company':
        return await createCompanyTool(apiClient, args);

      case 'update_company':
        return await updateCompanyTool(apiClient, args);

      case 'delete_company':
        return await deleteCompanyTool(apiClient, args);

      case 'list_projects':
        return await listProjectsTool(apiClient, args);

      case 'get_project':
        return await getProjectTool(apiClient, args);

      case 'create_project':
        return await createProjectTool(apiClient, args, config);

      case 'update_project':
        return await updateProjectTool(apiClient, args, config);

      case 'delete_project':
        return await deleteProjectTool(apiClient, args);

      case 'copy_project':
        return await copyProjectTool(apiClient, args);

      case 'list_tasks':
        return await listTasksTool(apiClient, args);

      case 'get_project_tasks':
        return await getProjectTasksTool(apiClient, args);

      case 'get_task':
        return await getTaskTool(apiClient, args);

      case 'my_tasks':
        return await myTasksTool(apiClient, config, args);

      case 'list_boards':
        return await listBoards(apiClient, args);

      case 'get_board':
        return await getBoard(apiClient, args);

      case 'create_board':
        return await createBoard(apiClient, args);

      case 'update_board':
        return await updateBoard(apiClient, args);

      case 'delete_board':
        return await deleteBoard(apiClient, args);

      case 'create_task':
        return await createTaskTool(apiClient, args, config);

      case 'update_task_assignment':
        return await updateTaskAssignmentTool(apiClient, args, config);

      case 'update_task_details':
        return await updateTaskDetailsTool(apiClient, args);

      case 'delete_task':
        return await deleteTaskTool(apiClient, args);

      case 'add_task_comment':
        return await addTaskCommentTool(apiClient, args);

      case 'list_comments':
        return await listCommentsTool(apiClient, args);

      case 'update_task_status':
        return await updateTaskStatusTool(apiClient, args);

      case 'list_workflow_statuses':
        return await listWorkflowStatusesTool(apiClient, args);

      case 'list_task_lists':
        return await listTaskLists(apiClient, args);

      case 'get_task_list':
        return await getTaskList(apiClient, args);

      case 'create_task_list':
        return await createTaskList(apiClient, args);

      case 'update_task_list':
        return await updateTaskList(apiClient, args);

      case 'delete_task_list':
        return await deleteTaskList(apiClient, args);

      case 'list_activities':
        return await listActivities(apiClient, args);

      case 'get_recent_updates':
        return await getRecentUpdates(apiClient, args);

      case 'list_time_entries':
        return await listTimeEntriesTool(apiClient, args, config);

      case 'create_time_entry':
        return await createTimeEntryTool(apiClient, args, config);

      case 'update_time_entry':
        return await updateTimeEntryTool(apiClient, args);

      case 'delete_time_entry':
        return await deleteTimeEntryTool(apiClient, args);

      case 'list_project_deals':
        return await listProjectDealsTool(apiClient, args);

      case 'list_deal_services':
        return await listDealServicesTool(apiClient, args);

      case 'get_deal':
        return await getDealTool(apiClient, args);

      case 'create_deal':
        return await createDealTool(apiClient, args, config);

      case 'update_deal':
        return await updateDealTool(apiClient, args, config);

      case 'delete_deal':
        return await deleteDealTool(apiClient, args);

      case 'copy_deal':
        return await copyDealTool(apiClient, args);

      case 'list_services':
        return await listServicesTool(apiClient, args);

      case 'create_service':
        return await createServiceTool(apiClient, args);

      case 'update_service':
        return await updateServiceTool(apiClient, args);

      case 'update_task_sprint':
        return await updateTaskSprint(apiClient, args);

      case 'move_task_to_list':
        return await moveTaskToList(apiClient, args);

      case 'add_to_backlog':
        return await addToBacklog(apiClient, args);

      case 'reposition_task':
        // Ensure args has the required taskId property
        if (!args?.taskId) {
          throw new Error('taskId is required for task repositioning');
        }
        return await taskRepositionTool(apiClient, args as z.infer<typeof taskRepositionSchema>);

      case 'list_tax_rates':
        return await listTaxRatesTool(apiClient, args);

      case 'list_document_types':
        return await listDocumentTypesTool(apiClient, args);

      case 'list_invoices':
        return await listInvoicesTool(apiClient, args);

      case 'get_invoice':
        return await getInvoiceTool(apiClient, args);

      case 'delete_invoice':
        return await deleteInvoiceTool(apiClient, args);

      case 'create_invoice':
        return await createInvoiceTool(apiClient, args);

      case 'update_invoice':
        return await updateInvoiceTool(apiClient, args);

      case 'link_invoice_to_budget':
        return await linkInvoiceToBudgetTool(apiClient, args);

      case 'create_line_item':
        return await createLineItemTool(apiClient, args);

      case 'finalize_invoice':
        return await finalizeInvoiceTool(apiClient, args);

      case 'list_payments':
        return await listPaymentsTool(apiClient, args);

      case 'delete_payment':
        return await deletePaymentTool(apiClient, args);

      case 'list_invoice_attributions':
        return await listInvoiceAttributionsTool(apiClient, args);

      case 'delete_invoice_attribution':
        return await deleteInvoiceAttributionTool(apiClient, args);

      case 'delete_task_comment':
        return await deleteTaskCommentTool(apiClient, args);

      case 'list_documents':
        return await listDocumentsTool(apiClient, args);

      case 'get_document':
        return await getDocumentTool(apiClient, args);

      case 'create_document':
        return await createDocumentTool(apiClient, args);

      case 'update_document':
        return await updateDocumentTool(apiClient, args);

      case 'delete_document':
        return await deleteDocumentTool(apiClient, args);

      case 'list_expenses':
        return await listExpensesTool(apiClient, args);

      case 'create_expense':
        return await createExpenseTool(apiClient, args, config);

      case 'delete_expense':
        return await deleteExpenseTool(apiClient, args);

      case 'list_rate_cards':
        return await listRateCardsTool(apiClient, args);

      case 'get_rate_card':
        return await getRateCardTool(apiClient, args);

      case 'create_rate_card':
        return await createRateCardTool(apiClient, args);

      case 'update_rate_card':
        return await updateRateCardTool(apiClient, args);

      case 'delete_rate_card':
        return await deleteRateCardTool(apiClient, args);

      case 'archive_rate_card':
        return await archiveRateCardTool(apiClient, args);

      case 'restore_rate_card':
        return await restoreRateCardTool(apiClient, args);

      case 'list_prices':
        return await listPricesTool(apiClient, args);

      case 'get_price':
        return await getPriceTool(apiClient, args);

      case 'create_price':
        return await createPriceTool(apiClient, args);

      case 'update_price':
        return await updatePriceTool(apiClient, args);

      case 'delete_price':
        return await deletePriceTool(apiClient, args);

      case 'list_todos':
        return await listTodosTool(apiClient, args, config);

      case 'create_todo':
        return await createTodoTool(apiClient, args, config);

      case 'update_todo':
        return await updateTodoTool(apiClient, args);

      case 'delete_todo':
        return await deleteTodoTool(apiClient, args);

      case 'list_bookings':
        return await listBookingsTool(apiClient, args, config);

      case 'get_booking':
        return await getBookingTool(apiClient, args);

      case 'create_booking':
        return await createBookingTool(apiClient, args, config);

      case 'update_booking':
        return await updateBookingTool(apiClient, args);

      case 'delete_booking':
        return await deleteBookingTool(apiClient, args);

      case 'get_report':
        return await getReportTool(apiClient, args);

      case 'list_people':
        return await listPeopleTool(apiClient, args);

      case 'get_person':
        return await getPersonTool(apiClient, args);

      case 'create_person':
        return await createPersonTool(apiClient, args);

      case 'update_person':
        return await updatePersonTool(apiClient, args);

      case 'list_custom_roles':
        return await listCustomRolesTool(apiClient, args);

      case 'invite_person':
        return await invitePersonTool(apiClient, args);

      case 'set_cost_rate':
        return await setCostRateTool(apiClient, args);

      case 'list_cost_rates':
        return await listCostRatesTool(apiClient, args);

      case 'update_cost_rate':
        return await updateCostRateTool(apiClient, args);

      case 'add_project_member':
        return await addProjectMemberTool(apiClient, args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  // Register prompt handlers
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      timesheetPromptDefinition,
      quickTimesheetPromptDefinition,
    ],
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'timesheet_entry':
        return await generateTimesheetPrompt(args);

      case 'timesheet_step':
        return await generateQuickTimesheetPrompt(args);

      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Don't output anything to stdout/stderr after connecting
  // as it can interfere with the MCP protocol

  return server;
}
