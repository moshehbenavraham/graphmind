// Quick test of local FalkorDB connection
import { connect } from 'cloudflare:sockets';

async function testLocalFalkorDB() {
  console.log('Connecting to local FalkorDB...');

  const socket = connect({
    hostname: 'localhost',
    port: 6380
  });

  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();

  // Send PING command
  const pingCmd = '*1\r\n$4\r\nPING\r\n';
  await writer.write(new TextEncoder().encode(pingCmd));

  // Read response
  const { value, done } = await reader.read();
  const response = new TextDecoder().decode(value);

  console.log('Response:', response);

  await writer.close();
  await reader.cancel();

  console.log('✅ Local FalkorDB working!');
}

testLocalFalkorDB().catch(console.error);
