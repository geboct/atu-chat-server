const WebSocket = require('ws');
const http = require('http');
const fetch = require('node-fetch'); // 👈 import node-fetch

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const clients = new Map();

wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.replace('/?', ''));
    const userId = params.get('user_id');

    if (userId) {
        clients.set(userId, ws);
        console.log(`✅ User connected: ${userId}`);
    }

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            const { from, to, content, timestamp } = data;

            // 1. Forward message if recipient is connected
            if (clients.has(to)) {
                clients.get(to).send(JSON.stringify(data));
                console.log(`📤 ${from} ➡ ${to}: ${content}`);
            } else {
                console.log(`❌ ${to} is not connected`);
            }

            // 2. Save to MySQL via PHP API
            await fetch('https://joagyapongltd.com/guidance_and_counselling/api/save_chat.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    from,
                    to,
                    message: content,
                    timestamp: timestamp || new Date().toISOString()
                })
            });

        } catch (err) {
            console.error('❗ Error processing message:', err);
        }
    });

    ws.on('close', () => {
        if (userId) {
            clients.delete(userId);
            console.log(`🔌 User disconnected: ${userId}`);
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🚀 WebSocket Server running on port ${PORT}`);
});
