const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.post('/scrape', (req, res) => {
  const urls = req.body.urls.split('\n').map(u => u.trim()).filter(Boolean).slice(0, 20);
  const py = spawn('python', ['scraper.py', ...urls]);

  py.on('close', () => {
    const results = JSON.parse(fs.readFileSync('results.json', 'utf8'));
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Validation Results</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
      </head>
      <body class="p-4">
        <div class="container">
          <h2 class="mb-4">Validation Results</h2>
          <table class="table table-bordered table-striped">
            <thead class="table-dark">
              <tr>
                <th>#</th>
                <th>URL</th>
                <th>Updated On (Visible)</th>
                <th>dateModified (Schema)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>`;

    results.forEach((row, index) => {
      html += `
        <tr>
          <td>${index + 1}</td>
          <td><a href="${row.url}" target="_blank">${row.url}</a></td>
          <td>${row.updatedOn}</td>
          <td>${row.dateModified}</td>
          <td>${row.match ? '✅ Match' : '❌ Mismatch'}</td>
        </tr>`;
    });

    html += `
            </tbody>
          </table>
          <a href="/" class="btn btn-secondary mt-3">← Back</a>
        </div>
      </body>
      </html>
    `;
    res.send(html);
  });
});

app.listen(PORT, () => console.log(`✅ App running at http://localhost:${PORT}`));
