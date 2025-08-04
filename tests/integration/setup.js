import { beforeAll, afterAll } from 'vitest';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://mcp-docs-server-test:3000';
const MAX_RETRIES = 30;
const RETRY_DELAY = 1000;

// Global test configuration
global.MCP_SERVER_URL = MCP_SERVER_URL;

// Wait for health endpoint to be available
async function waitForHealthEndpoint() {
  console.log(`Waiting for health endpoint at ${MCP_SERVER_URL}...`);
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await fetch(`${MCP_SERVER_URL}/health`);
      if (response.ok) {
        console.log('✅ Health endpoint is ready');
        return;
      }
    } catch (error) {
      console.log(`⏳ Attempt ${i + 1}/${MAX_RETRIES}: Health endpoint not ready yet...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  
  throw new Error(`Health endpoint at ${MCP_SERVER_URL} did not become ready within ${MAX_RETRIES * RETRY_DELAY / 1000} seconds`);
}

// Test MCP HTTP endpoints directly
async function testMCPHTTPEndpoints() {
  console.log('🧪 Testing MCP HTTP endpoints...');
  
  try {
    // Test SSE endpoint (should return SSE stream)
    console.log('Testing MCP SSE endpoint...');
    const sseResponse = await fetch(`${MCP_SERVER_URL}/mcp`, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (sseResponse.ok && sseResponse.headers.get('content-type')?.includes('text/event-stream')) {
      console.log('✅ MCP SSE endpoint responds correctly');
      
      // Try to read first SSE event to get session endpoint
      const reader = sseResponse.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        const sseData = new TextDecoder().decode(value);
        console.log('📨 SSE data received:', sseData.substring(0, 100) + '...');
        reader.releaseLock();
      }
      
      // Close the SSE connection
      sseResponse.body?.cancel();
    } else {
      console.warn('⚠️ MCP SSE endpoint not working as expected');
    }
    
    console.log('✅ MCP HTTP endpoints test completed');
    
  } catch (error) {
    console.error('❌ MCP HTTP endpoints test failed:', error.message);
    // Don't throw here - let the individual tests handle failures
  }
}

beforeAll(async () => {
  await waitForHealthEndpoint();
  await testMCPHTTPEndpoints();
  console.log('🎯 Integration tests starting...');
});

afterAll(() => {
  console.log('✅ Integration tests completed');
});