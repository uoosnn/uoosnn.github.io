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

    const urls = parsed.urlset.url.map(u => u.loc[0]);
    console.log(`Found ${urls.length} URLs in sitemap.xml.`);

    // 4. Authenticate with Google API
    const jwtClient = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/indexing'],
      null
    );

    await jwtClient.authorize();
    const indexing = google.indexing({
      version: 'v3',
      auth: jwtClient,
    });

    // 5. Submit URLs to Indexing API
    let successCount = 0;
    let failCount = 0;

    for (const url of urls) {
      try {
        const res = await indexing.urlNotifications.publish({
          requestBody: {
            url: url,
            type: 'URL_UPDATED',
          },
        });
        if (res.status === 200) {
          successCount++;
          console.log(`[OK] Indexed: ${url}`);
        } else {
          failCount++;
          console.error(`[WARN] Failed to index: ${url} (Status: ${res.status})`);
        }
      } catch (error) {
        failCount++;
        if (error.response) {
          console.error(`[ERROR] Failed to index: ${url} - ${error.response.status} ${error.response.statusText}`);
          if (error.response.data && error.response.data.error) {
            console.error(error.response.data.error.message);
          }
        } else {
          console.error(`[ERROR] Failed to index: ${url} - ${error.message}`);
        }
      }
      
      // Sleep a bit to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\nIndexing complete. Success: ${successCount}, Fail: ${failCount}`);

  } catch (err) {
    console.error('Unhandled error during indexing:', err);
    process.exit(1);
  }
}

main();
