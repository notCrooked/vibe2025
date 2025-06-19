const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const PORT = 3000;

// Database connection settings
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'xxXX1234',
    database: 'todolist',
  };


  async function retrieveListItems() {
    try {
      // Create a connection to the database
      const connection = await mysql.createConnection(dbConfig);
      
      // Query to select all items from the database
      const query = 'SELECT id, text FROM items';
      
      // Execute the query
      const [rows] = await connection.execute(query);
      
      // Close the connection
      await connection.end();
      
      // Return the retrieved items as a JSON array
      return rows;
    } catch (error) {
      console.error('Error retrieving list items:', error);
      throw error; // Re-throw the error
    }
  }

// Stub function for generating HTML rows
async function getHtmlRows() {
    // Example data - replace with actual DB data later
    /*
    const todoItems = [
        { id: 1, text: 'First todo item' },
        { id: 2, text: 'Second todo item' }
    ];*/

    const todoItems = await retrieveListItems();

    // Generate HTML for each item
    return todoItems.map(item => `
        <tr>
            <td>${item.id}</td>
            <td>${item.text}</td>
            <td><button class="delete-btn">×</button></td>
        </tr>
    `).join('');
}

async function addItemToDb(text) {
    const connection = await mysql.createConnection(dbConfig);
    const query = 'INSERT INTO items (text) VALUES (?)';
    await connection.execute(query, [text]);
    await connection.end();
}

// Modified request handler with template replacement
async function handleRequest(req, res) {
    if (req.url === '/' && req.method === 'GET') {
        if (req.url === '/' && req.method === 'GET') {
    try {
        const html = await fs.promises.readFile(
            path.join(__dirname, 'index.html'),
            'utf8'
        );

        const processedHtml = html.replace('{{rows}}', await getHtmlRows());

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(processedHtml);
    } catch (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading index.html');
    }
}
    } else if (req.url === '/add-item' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const params = new URLSearchParams(body);
                const text = params.get('text');
                if (text && text.trim()) {
                    await addItemToDb(text.trim());
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'ok' }));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', message: 'Empty text' }));
                }
            } catch (err) {
                console.error(err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: 'Server error' }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Route not found');
    }
}

// Create and start server
const server = http.createServer(handleRequest);
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
