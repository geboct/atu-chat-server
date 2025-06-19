const WebSocket = require('ws');
const http = require('http');
const fetch = require('node-fetch');


const server = http.createServer();
const wss = new WebSocket.Server({ server });

const clients = new Map();

wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.replace('/?', ''));
    const userId = params.get('user_id');

    if (userId) {
        clients.set(userId, ws);
        console.log(` User connected: ${userId}`);
    }

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const { from, to, content, timestamp } = data;

            // Forward to the recipient if connected
            if (clients.has(to)) {
                clients.get(to).send(JSON.stringify({ from, to, content, timestamp }));
                console.log(` ${from} ➡ ${to}: ${content}`);
            } else {
                console.log(` ${to} is not connected`);
            }

            // Save message to PHP API
            fetch('https://joagyapongltd.com/guidance_and_counselling/api/save_chat.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from,
                    to,
                    content,
                    timestamp
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    console.log('💾 Message saved to DB');
                } else {
                    console.error('❌ Failed to save message:', data.message);
                }
            })
            .catch(err => console.error(' PHP save error:', err));


        } catch (err) {
            console.error(' Invalid message format', err);
        }
    });

    ws.on('close', () => {
        if (userId) {
            clients.delete(userId);
            console.log(` User disconnected: ${userId}`);
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(` WebSocket Server running on port ${PORT}`);
});
