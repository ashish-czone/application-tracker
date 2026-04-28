export interface ServerConfig {
  apiUrl: string;
  apiToken: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const apiUrl = env.PROJECTS_API_URL;
  const apiToken = env.PROJECTS_API_TOKEN;

  const missing: string[] = [];
  if (!apiUrl) missing.push('PROJECTS_API_URL');
  if (!apiToken) missing.push('PROJECTS_API_TOKEN');
  if (missing.length > 0) {
    throw new Error(
      `projects-mcp: missing required env var(s): ${missing.join(', ')}`,
    );
  }

  return {
    apiUrl: apiUrl!.replace(/\/$/, ''),
    apiToken: apiToken!,
  };
}
