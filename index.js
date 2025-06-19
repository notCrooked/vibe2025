const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const mysql  = require('mysql2/promise');
const cookie = require('cookie');

const PORT = 3000;

// ────────────────────── DB CONFIG ──────────────────────
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'xxXX1234',
  database: 'todolist',
};

// ────────────────────── HELPERS ──────────────────────
async function checkUserCredentials(username, password) {
  const conn = await mysql.createConnection(dbConfig);
  const [rows] = await conn.execute(
    'SELECT 1 FROM users WHERE username = ? AND password = ?',
    [username, password]
  );
  await conn.end();
  return rows.length > 0;
}

async function retrieveListItems() {
  const conn = await mysql.createConnection(dbConfig);
  const [rows] = await conn.execute('SELECT id, text FROM items');
  await conn.end();
  return rows;
}

async function addItemToDb(text) {
  const conn = await mysql.createConnection(dbConfig);
  await conn.execute('INSERT INTO items (text) VALUES (?)', [text]);
  await conn.end();
}

async function deleteItemFromDb(id) {
  const conn = await mysql.createConnection(dbConfig);
  await conn.execute('DELETE FROM items WHERE id = ?', [id]);
  await conn.end();
}

async function updateItemInDb(id, newText) {
  const conn = await mysql.createConnection(dbConfig);
  await conn.execute('UPDATE items SET text = ? WHERE id = ?', [newText, id]);
  await conn.end();
}

// таблица → строки HTML
async function getHtmlRows() {
  const items = await retrieveListItems();
  return items
    .map(
      (it, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${it.text}</td>
          <td>
            <button onclick="editItem(${it.id}, '${it.text.replace(/'/g, "\\'")}')">Edit</button>
            <button onclick="deleteItem(${it.id})">×</button>
          </td>
        </tr>`
    )
    .join('');
}

// ────────────────────── SERVER HANDLER ──────────────────────
async function handleRequest(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const isAuth  = cookies.auth === 'true';

  // ========= LOGIN FORM (GET) =========
  if (req.url === '/login' && req.method === 'GET') {
    const loginHtml = `
      <h2 style="text-align:center;">Login</h2>
      <form method="POST" action="/login" style="width:300px;margin:0 auto;text-align:center;">
        <input name="username" placeholder="Username" required style="padding:5px;margin:5px;"><br>
        <input name="password" type="password" placeholder="Password" required style="padding:5px;margin:5px;"><br>
        <button type="submit" style="padding:5px 10px;">Login</button>
      </form>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(loginHtml);
    return;
  }

  // ========= SUBMIT LOGIN (POST) =========
  if (req.url === '/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', async () => {
      const p = new URLSearchParams(body);
      const ok = await checkUserCredentials(p.get('username'), p.get('password'));
      if (ok) {
        res.writeHead(302, {
          'Set-Cookie': cookie.serialize('auth', 'true', { httpOnly: true }),
          Location: '/',
        });
      } else {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.write('Invalid credentials');
      }
      res.end();
    });
    return;
  }

  // ========= ПРОТЕКЦИЯ ДЛЯ ВСЕХ ДРУГИХ РОУТОВ =========
  if (!isAuth) {
    // только JSON‑маршруты возвращаем 401, а к / перенаправляем на /login
    if (req.url === '/' && req.method === 'GET') {
      res.writeHead(302, { Location: '/login' });
      res.end();
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: 'Unauthorized' }));
    }
    return;
  }

  // ========= MAIN PAGE =========
  if (req.url === '/' && req.method === 'GET') {
    try {
      const html = await fs.promises.readFile(path.join(__dirname, 'index.html'), 'utf8');
      const page = html.replace('{{rows}}', await getHtmlRows());
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(page);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading page');
    }
    return;
  }

  // ========= ADD ITEM =========
  if (req.url === '/add-item' && req.method === 'POST') {
    handleBody(req, res, async params => {
      const text = params.get('text');
      if (text && text.trim()) await addItemToDb(text.trim());
      resJson(res, { status: 'ok' });
    });
    return;
  }

  // ========= DELETE ITEM =========
  if (req.url === '/delete-item' && req.method === 'POST') {
    handleBody(req, res, async params => {
      const id = params.get('id');
      if (id) await deleteItemFromDb(id);
      resJson(res, { status: 'ok' });
    });
    return;
  }

  // ========= UPDATE ITEM =========
  if (req.url === '/update-item' && req.method === 'POST') {
    handleBody(req, res, async params => {
      const id = params.get('id');
      const text = params.get('text');
      if (id && text && text.trim()) await updateItemInDb(id, text.trim());
      resJson(res, { status: 'ok' });
    });
    return;
  }

  // ========= 404 =========
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Route not found');
}

// ────────────────────── UTILITIES ──────────────────────
function handleBody(req, res, cb) {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => cb(new URLSearchParams(body)).catch(err => err500(res, err)));
}

function resJson(res, obj) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function err500(res, err) {
  console.error(err);
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'error', message: 'Server error' }));
}

// ────────────────────── START ──────────────────────
http.createServer(handleRequest).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
