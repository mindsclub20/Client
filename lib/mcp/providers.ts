/**
 * MAXWEB MCP integration catalog.
 * Only two external providers are supported: GitHub and Supabase.
 * Official remote endpoints (not Composio or third-party marketplaces).
 */

export const MCP_PROVIDERS = ["github", "supabase"] as const;
export type McpProviderId = (typeof MCP_PROVIDERS)[number];

export type McpToolDescriptor = {
  id: string;
  name: string;
  description: string;
  risk: "read" | "write" | "destructive";
};

export type McpProviderDefinition = {
  id: McpProviderId;
  label: string;
  officialMcpUrl: string;
  authModes: string[];
  permissions: string[];
  tools: McpToolDescriptor[];
  envHints: string[];
};

export const GITHUB_MCP: McpProviderDefinition = {
  id: "github",
  label: "GitHub",
  officialMcpUrl: "https://api.githubcopilot.com/mcp/",
  authModes: ["OAuth (MCP host)", "Personal Access Token (Bearer)"],
  permissions: [
    "Read repositories, branches, commits, and files",
    "List and review pull requests and issues",
    "Inspect Actions workflows",
    "Write operations require elevated token scopes and explicit approval",
  ],
  envHints: ["GITHUB_TOKEN or GH_TOKEN (server-only, optional for status)"],
  tools: [
    {
      id: "list_repos",
      name: "List repositories",
      description: "List accessible repositories for the authorized account.",
      risk: "read",
    },
    {
      id: "read_file",
      name: "Read file",
      description: "Read source files from a repository path.",
      risk: "read",
    },
    {
      id: "list_branches",
      name: "List branches",
      description: "Inspect branches for a repository.",
      risk: "read",
    },
    {
      id: "list_pulls",
      name: "List pull requests",
      description: "Review open and closed pull requests.",
      risk: "read",
    },
    {
      id: "list_workflows",
      name: "List workflows",
      description: "Inspect GitHub Actions workflow definitions.",
      risk: "read",
    },
  ],
};

export const SUPABASE_MCP: McpProviderDefinition = {
  id: "supabase",
  label: "Supabase",
  officialMcpUrl: "https://mcp.supabase.com/mcp",
  authModes: ["OAuth (hosted MCP)", "Project URL + service role (server-only)"],
  permissions: [
    "Inspect project health and schema",
    "List tables, functions, and migrations",
    "Run authorized SQL under service-role or RLS-bound clients",
    "Schema changes and destructive SQL require explicit approval",
  ],
  envHints: [
    "SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_ANON_KEY / publishable key",
    "SUPABASE_SERVICE_ROLE_KEY (server-only, never browser)",
  ],
  tools: [
    {
      id: "list_tables",
      name: "List tables",
      description: "List public schema tables and RLS flags.",
      risk: "read",
    },
    {
      id: "inspect_schema",
      name: "Inspect schema",
      description: "Read column definitions for AI-related tables.",
      risk: "read",
    },
    {
      id: "list_migrations",
      name: "List migrations",
      description: "Show applied migration versions when available.",
      risk: "read",
    },
    {
      id: "project_status",
      name: "Project status",
      description: "Report configured project URL and connectivity.",
      risk: "read",
    },
  ],
};

export function getProvider(id: McpProviderId): McpProviderDefinition {
  return id === "github" ? GITHUB_MCP : SUPABASE_MCP;
}

export function listProviders(): McpProviderDefinition[] {
  return [GITHUB_MCP, SUPABASE_MCP];
}
