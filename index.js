const WebSocket = require('ws');
const http = require('http');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const server = http.createServer();
const wss = new WebSocket.Server({ server });
const clients = new Map();

function heartbeat() {
  this.isAlive = true;
}

wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url.replace('/?', ''));
  const userId = params.get('user_id');

  ws.isAlive = true;
  ws.on('pong', heartbeat);

  if (userId) {
    clients.set(userId, ws);
    console.log(`✅ User connected: ${userId}`);
  }

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      const {
        type = 'message',
        from,
        to,
        content,
        timestamp = new Date().toISOString(),
        message_id,
        message_type = 'text'
      } = data;

      switch (type) {
        case 'ping':
          ws.isAlive = true;
          break;

        case 'typing':
          if (clients.has(to)) {
            clients.get(to).send(JSON.stringify({ type: 'typing', from }));
          }
          break;

        case 'read':
          if (clients.has(to)) {
            clients.get(to).send(JSON.stringify({ type: 'read', from, to, message_id }));
          }
          await fetch('https://joagyapongltd.com/guidance_and_counselling/api/markMessageAsRead.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message_id }),
          });
          break;

        case 'delete':
          if (clients.has(to)) {
            clients.get(to).send(JSON.stringify({ type: 'delete', message_id, by: from }));
          }
          await fetch('https://joagyapongltd.com/guidance_and_counselling/api/delete_chat.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message_id }),
          });
          break;

        case 'edit':
          const editPayload = { type: 'edit', message_id, content };
          if (clients.has(to)) clients.get(to).send(JSON.stringify(editPayload));
          if (clients.has(from)) clients.get(from).send(JSON.stringify(editPayload));

          await fetch('https://joagyapongltd.com/guidance_and_counselling/api/edit_chat.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message_id, new_content: content }),
          });
          break;

        case 'message':
        default:
          const response = await fetch('https://joagyapongltd.com/guidance_and_counselling/api/save_chat.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from,
              to,
              content,
              timestamp,
              type: message_type
            }),
          });

          let result;
          try {
            result = await response.json();
          } catch (parseErr) {
            console.error('❗ JSON parse error from PHP:', parseErr);
            return;
          }

          if (result.status === 'success') {
            const msgData = {
              type: 'message',
              from,
              to,
              content,
              timestamp: result.timestamp,
              message_id: result.message_id,
              is_read: '0',
              message_type,
            };

            if (clients.has(to)) {
              clients.get(to).send(JSON.stringify(msgData));
              console.log(`📤 ${from} ➡ ${to}: [${message_type}] ${content}`);
            }
          } else {
            console.error('❌ Save failed:', result.message);
          }
      }
    } catch (err) {
      console.error('❗ Invalid message format:', err);
    }
  });

  ws.on('close', () => {
    if (userId) {
      clients.delete(userId);
      console.log(`🔌 Disconnected: ${userId}`);
    }
  });
});

// Heartbeat every 30 seconds
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('❌ Terminating dead socket');
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 WebSocket Server running on port ${PORT}`);
});
