const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;

const server = new WebSocket.Server({ port: PORT });

let clients = [];

server.on('connection', (socket) => {
  clients.push(socket);
  console.log('Client connected');

  socket.on('message', (message) => {
    console.log('Received:', message);

    // Broadcast to other clients
    clients.forEach((client) => {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  socket.on('close', () => {
    clients = clients.filter((c) => c !== socket);
    console.log('Client disconnected');
  });
});
