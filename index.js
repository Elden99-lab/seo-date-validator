const express = require("express");
const bodyParser = require("body-parser");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3333;

// Serve static files from the new folder
app.use(express.static("downloaded_csv"));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>SEO Content Checker</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
          textarea { width: 100%; height: 200px; margin-top: 10px; font-size: 14px; }
          button { padding: 10px 20px; font-size: 16px; margin-top: 20px; cursor: pointer; }
          #loading { display: none; font-weight: bold; color: #0077cc; margin-top: 20px; }
        </style>
        <script>
          function showLoading() {
            document.getElementById('loading').style.display = 'block';
          }
        </script>
      </head>
      <body>
        <h1>SEO Content Date Validator</h1>
        <form method="POST" action="/check" onsubmit="showLoading()">
          <label>Enter up to 20 URLs (one per line):</label><br>
          <textarea name="urls" required></textarea><br>
          <button type="submit">Validate</button>
        </form>
        <div id="loading">⏳ Scraping in progress... please wait.</div>
      </body>
    </html>
  `);
});

app.post("/check", (req, res) => {
  const urls = req.body.urls
    .split("\n")
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    .slice(0, 20); // Limit to 20 URLs

  if (urls.length === 0) {
    return res.send("Please enter at least one URL.");
  }

  const pythonScript = "scraper.py";
  const args = urls;

  execFile("python", [pythonScript, ...args], (error, stdout, stderr) => {
    if (error) {
      console.error("Python error:", error.message);
      return res.send("Something went wrong while running the scraper.");
    }

    fs.readFile("results.json", "utf8", (err, data) => {
      if (err) {
        console.error("File read error:", err);
        return res.send("Could not read results.");
      }

      let results;
      try {
        results = JSON.parse(data);
      } catch (parseErr) {
        console.error("JSON parse error:", parseErr);
        return res.send("Could not parse results.");
      }

      // Create CSV content
      const csvHeader = "Status,Updated On,dateModified,URL\n";
      const csvRows = results
        .map((r) => {
          const status = r.match ? "✅" : "❌";
          return `"${status}","${r.updatedOn}","${r.dateModified}","${r.url}"`;
        })
        .join("\n");
      const csvData = csvHeader + csvRows;

      const csvDir = path.join(__dirname, "downloaded_csv");
      const csvPath = path.join(csvDir, "results.csv");

      // ✅ Make sure folder exists
      if (!fs.existsSync(csvDir)) {
        fs.mkdirSync(csvDir);
      }

      fs.writeFileSync(csvPath, csvData, "utf8");

      // Table Rows
      const tableRows = results
        .map((r) => {
          const status = r.match ? "✅" : "❌";
          const rowClass = r.match ? "pass" : "fail";
          return `
            <tr class="${rowClass}">
              <td>${status}</td>
              <td>${r.updatedOn}</td>
              <td>${r.dateModified}</td>
              <td><a href="${r.url}" target="_blank">${r.url}</a></td>
            </tr>
          `;
        })
        .join("");

      res.send(`
        <html>
          <head>
            <title>Validation Results</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
              table { width: 100%; border-collapse: collapse; margin-top: 30px; background: white; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              th { background-color: #eee; }
              tr:nth-child(even) { background-color: #f9f9f9; }
              .fail { background-color: #ffe5e5; }
              .pass { background-color: #e6ffe6; }
              a { text-decoration: none; color: #0077cc; }
              .export { margin-top: 20px; display: inline-block; padding: 10px 15px; background: #0077cc; color: white; text-decoration: none; border-radius: 4px; }
            </style>
          </head>
          <body>
            <h1>Validation Results</h1>
            <a class="export" href="/results.csv" download>⬇️ Export as CSV</a>
            <table>
              <tr>
                <th>Status</th>
                <th>Updated On</th>
                <th>dateModified</th>
                <th>URL</th>
              </tr>
              ${tableRows}
            </table>
            <br>
            <a href="/">← Back to tool</a>
          </body>
        </html>
      `);
    });
  });
});

app.listen(PORT, () => {
  console.log(`✅ SEO checker app running at http://localhost:${PORT}`);
});
