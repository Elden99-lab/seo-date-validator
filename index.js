const express = require('express');
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = 3333; // Custom port

app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(express.static('public'));

app.get('/', (req, res) => {
  const resultHTML = fs.existsSync('./public/results.html')
    ? fs.readFileSync('./public/results.html', 'utf8')
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>SEO Date Validator</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        input[type=text] { width: 100%; padding: 10px; margin-bottom: 10px; }
        button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f4f4f4; }
        .loading { font-size: 16px; color: #555; }
        .download-btn { margin-top: 20px; display: inline-block; background: #4CAF50; color: white; padding: 10px 15px; text-decoration: none; }
      </style>
    </head>
    <body>
      <h2>SEO Date Validator Tool</h2>
      <form method="POST" action="/check">
        <textarea name="urls" placeholder="Enter up to 20 URLs, one per line..." rows="10" required></textarea><br>
        <button type="submit">Run Validator</button>
      </form>

      ${resultHTML}

      ${resultHTML ? '<a class="download-btn" href="/download">⬇ Download CSV</a>' : ''}
    </body>
    </html>
  `;
  res.send(html);
});

app.post('/check', (req, res) => {
  const urls = req.body.urls
    .split('\n')
    .map(u => u.trim())
    .filter(Boolean)
    .slice(0, 20);

  const command = `
    if [ ! -d "venv" ]; then
      python3 -m venv venv
      source venv/bin/activate
      venv/bin/pip install --upgrade pip
      venv/bin/pip install -r requirements.txt
    fi
    source venv/bin/activate
    venv/bin/python scraper.py ${urls.join(' ')}
  `;

  exec(command, { shell: '/bin/bash' }, (err, stdout, stderr) => {
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

app.get('/download', (req, res) => {
  const file = path.join(__dirname, 'public', 'downloaded_csv', 'results.csv');
  res.download(file);
});

app.listen(PORT, () => {
  console.log(`✅ SEO checker app running at http://localhost:${PORT}`);
});
