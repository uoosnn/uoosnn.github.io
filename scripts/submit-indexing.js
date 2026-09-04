const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const xml2js = require('xml2js');

async function main() {
  try {
    // 1. Get credentials from environment variables
    const serviceAccountKeyStr = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKeyStr) {
      console.error('Error: GCP_SERVICE_ACCOUNT_KEY environment variable is not set.');
      process.exit(1);
    }

    let credentials;
    try {
      credentials = JSON.parse(serviceAccountKeyStr);
      // GitHub Actions 등에서 newline(\n)이 이스케이프되는 문제 방지
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    } catch (e) {
      console.error('Error parsing GCP_SERVICE_ACCOUNT_KEY as JSON:', e);
      process.exit(1);
    }

    // 2. Read sitemap.xml
    const sitemapPath = path.resolve(__dirname, '../.vitepress/dist/sitemap.xml');
    if (!fs.existsSync(sitemapPath)) {
      console.error(`Error: sitemap.xml not found at ${sitemapPath}`);
      process.exit(1);
    }

    const sitemapXml = fs.readFileSync(sitemapPath, 'utf-8');
    
    // 3. Parse URLs from sitemap.xml
    const parser = new xml2js.Parser();
    const parsed = await parser.parseStringPromise(sitemapXml);
    
    if (!parsed || !parsed.urlset || !parsed.urlset.url) {
      console.error('Error: Invalid sitemap format.');
      process.exit(1);
    }

    const urls = parsed.urlset.url
      .map(u => u.loc[0])
      .filter(u => !u.includes('?') && !u.includes('404'));
    console.log(`Found ${urls.length} valid URLs in sitemap.xml.`);

    // 4. Authenticate with Google API
    if (!credentials.client_email || !credentials.private_key) {
      console.error('Error: Parsed JSON does not contain client_email or private_key.');
      console.error('Keys found in JSON:', Object.keys(credentials).join(', '));
      process.exit(1);
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });

    const authClient = await auth.getClient();

    // 5. Submit URLs to Indexing API using Batch Requests (Max 100 per batch)
    const BATCH_SIZE = 100;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const chunk = urls.slice(i, i + BATCH_SIZE);
      console.log(`Sending batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} URLs)...`);
      
      const boundary = 'batch_boundary';
      let body = '';
      
      // Construct multipart/mixed body
      chunk.forEach((url, index) => {
        const payload = JSON.stringify({ url: url, type: 'URL_UPDATED' });
        body += `--${boundary}\r\n`;
        body += `Content-Type: application/http\r\n`;
        body += `Content-ID: <item${index}>\r\n\r\n`;
        body += `POST /v3/urlNotifications:publish HTTP/1.1\r\n`;
        body += `Content-Type: application/json\r\n`;
        body += `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n`;
        body += `${payload}\r\n`;
      });
      body += `--${boundary}--\r\n`;

      try {
        const res = await authClient.request({
          url: 'https://indexing.googleapis.com/batch',
          method: 'POST',
          headers: {
            'Content-Type': `multipart/mixed; boundary=${boundary}`
          },
          data: body
        });

        if (res.status === 200) {
          successCount += chunk.length;
          console.log(`[OK] Batch ${Math.floor(i / BATCH_SIZE) + 1} accepted.`);
        } else {
          failCount += chunk.length;
          console.error(`[WARN] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed with status: ${res.status}`);
        }
      } catch (error) {
        failCount += chunk.length;
        console.error(`[ERROR] Batch request failed: ${error.message}`);
      }
    }

    console.log(`\nIndexing complete. Success (Received by API): ${successCount}, Fail: ${failCount}`);
    
    if (urls.length > 200) {
      console.warn('\n[Warning] Google Indexing API default daily quota is 200 requests.');
      console.warn('You submitted more than 200 URLs. Some URLs may not be processed by Google.');
    }

  } catch (err) {
    console.error('Unhandled error during indexing:', err);
    process.exit(1);
  }
}

main();
