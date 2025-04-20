import express, { Request, Response } from 'express';
import { createSupabaseMcpServer } from './packages/mcp-server-supabase/src/server';
import { StreamTransport } from './packages/mcp-utils/src/stream-transport';

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 10000;

// Middleware pour parser le JSON
app.use(express.json());

// Endpoint SSE pour la communication MCP
app.get('/mcp', (req: Request, res: Response) => {
  // Configurer les headers SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Créer un transport personnalisé
  const transport = new StreamTransport();

  // Créer le serveur MCP
  const server = createSupabaseMcpServer({
    platform: {
      accessToken: process.env.SUPABASE_ACCESS_TOKEN || '',
      apiUrl: process.env.SUPABASE_API_URL || '',
    },
    readOnly: process.env.READ_ONLY === 'true',
  });

  // Connecter le serveur MCP au transport
  server.connect(transport).catch((error: Error) => {
    console.error('Error connecting MCP server:', error);
    res.end();
  });

  // Gérer les messages entrants
  req.on('data', (chunk: Buffer) => {
    try {
      const message = JSON.parse(chunk.toString());
      transport.send(message);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error parsing message:', error);
      }
    }
  });

  // Envoyer les messages sortants
  transport.onmessage = (message) => {
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  };

  // Gérer la déconnexion du client
  req.on('close', () => {
    transport.close().catch((error: Error) => {
      console.error('Error closing transport:', error);
    });
  });
});

// Endpoint de santé
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`MCP Server running on port ${port}`);
}); 