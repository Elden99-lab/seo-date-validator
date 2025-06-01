const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3333;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>SEO Date Validator</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background: #f4f4f4; }
          h2 { color: #333; }
          textarea { width: 100%; height: 200px; margin-bottom: 10px; padding: 10px; font-size: 14px; }
          button { padding: 10px 20px; font-size: 16px; }
          .loading { display: none; margin-top: 10px; font-weight: bold; color: #007bff; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 14px; }
          th { background: #eee; }
          .export { margin-top: 20px; }
        </style>
      </head>
      <body>
        <h2>SEO Date Validator Tool</h2>
        <form action="/scrape" method="POST">
          <textarea name="urls" placeholder="Paste up to 20 URLs, one per line"></textarea><br>
          <button type="submit">Validate Dates</button>
          <div class="loading" id="loading">⏳ Scraping in progress. Please wait...</div>
        </form>
        <div class="export">
          <a href="/download-csv" target="_blank">⬇️ Download CSV</a>
        </div>
        <div id="results">
          ${fs.existsSync('public/results.html') ? fs.readFileSync('public/results.html', 'utf8') : ''}
        </div>
        <script>
          const form = document.querySelector('form');
          const loading = document.getElementById('loading');
          form.addEventListener('submit', () => { loading.style.display = 'block'; });
        </script>
      </body>
    </html>
  `);
});

app.post('/scrape', (req, res) => {
  const urls = req.body.urls
    .split('\n')
    .map(url => url.trim())
    .filter(url => url !== '')
    .slice(0, 20);

  if (urls.length === 0) return res.redirect('/');

  // Step 1: Create venv if it doesn’t exist
  const setupVenv = `
    if [ ! -d "venv" ]; then
      python3 -m venv venv &&
      source venv/bin/activate &&
      pip install --upgrade pip &&
      pip install -r requirements.txt;
    fi
  `;

  const runScript = `
    source venv/bin/activate &&
    venv/bin/python scraper.py ${urls.join(' ')}
  `;

  const fullCommand = `${setupVenv} && ${runScript}`;

  exec(fullCommand, { shell: '/bin/bash' }, (err, stdout, stderr) => {
    if (err) {
      console.error('Python error:', stderr);
      return res.send(`<pre style="color:red;">${stderr}</pre>`);
    }

    const lines = stdout.trim().split('\n');
    const rows = lines.map(line => {
      const [status, updatedOn, dateModified, ...urlParts] = line.split(' | ');
      return { status, updatedOn, dateModified, url: urlParts.join(' | ') };
    });

    const mismatches = rows.filter(r => r.status === '❌');
    const matches = rows.filter(r => r.status === '✅');
    const sorted = [...mismatches, ...matches];

    let html = `<table><tr><th>Status</th><th>Updated On</th><th>dateModified</th><th>URL</th></tr>`;
    sorted.forEach(r => {
      html += `<tr><td>${r.status}</td><td>${r.updatedOn}</td><td>${r.dateModified}</td><td><a href="${r.url}" target="_blank">${r.url}</a></td></tr>`;
    });
    html += `</table>`;

    fs.writeFileSync('public/results.html', html, 'utf8');

    const csv = 'Status,Updated On,dateModified,URL\n' +
      sorted.map(r => `${r.status},${r.updatedOn},${r.dateModified},"${r.url}"`).join('\n');
    const csvPath = path.join(__dirname, 'public', 'downloaded_csv', 'results.csv');
    fs.mkdirSync(path.dirname(csvPath), { recursive: true });
    fs.writeFileSync(csvPath, csv, 'utf8');

    res.redirect('/');
  });
});

app.get('/download-csv', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'downloaded_csv', 'results.csv');
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.send('No CSV found. Run a scrape first.');
  }
});

app.listen(PORT, () => {
  console.log(`✅ SEO checker app running at http://localhost:${PORT}`);
});
