import { beforeAll, afterAll } from 'vitest';
import axios from 'axios';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';
const MAX_RETRIES = 30;
const RETRY_DELAY = 1000;

// Global test configuration
global.MCP_SERVER_URL = MCP_SERVER_URL;
global.httpClient = axios.create({
  baseURL: MCP_SERVER_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'MCP-Docs-Integration-Tests/1.0'
  }
});

// Wait for server to be ready
async function waitForServer() {
  console.log(`Waiting for MCP server at ${MCP_SERVER_URL}...`);
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await global.httpClient.get('/health');
      if (response.status === 200) {
        console.log('✅ MCP server is ready');
        return;
      }
    } catch (error) {
      console.log(`⏳ Attempt ${i + 1}/${MAX_RETRIES}: Server not ready yet...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  
  throw new Error(`Server at ${MCP_SERVER_URL} did not become ready within ${MAX_RETRIES * RETRY_DELAY / 1000} seconds`);
}

beforeAll(async () => {
  await waitForServer();
  console.log('🚀 Integration tests starting...');
});

afterAll(() => {
  console.log('✅ Integration tests completed');
});