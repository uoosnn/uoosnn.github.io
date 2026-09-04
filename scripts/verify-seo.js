const fs = require('fs');

console.log('=== 1. Checking robots.txt ===');
const robots = fs.readFileSync('.vitepress/dist/robots.txt', 'utf8');
console.log(robots.trim());

console.log('\n=== 2. Checking Canonical and Hreflang in en/tech/index.html ===');
const enTech = fs.readFileSync('.vitepress/dist/en/tech/index.html', 'utf8');
console.log('Canonical:', enTech.match(/<link rel="canonical"[^>]+>/)?.[0]);
console.log('Hreflangs:', enTech.match(/<link rel="alternate" hreflang="[^"]+"[^>]+>/g));
console.log('OG Title:', enTech.match(/<meta property="og:title"[^>]+>/)?.[0]);
console.log('OG URL:', enTech.match(/<meta property="og:url"[^>]+>/)?.[0]);

console.log('\n=== 3. Checking Canonical and Hreflang in ja/blog/index.html ===');
const jaBlog = fs.readFileSync('.vitepress/dist/ja/blog/index.html', 'utf8');
console.log('Canonical:', jaBlog.match(/<link rel="canonical"[^>]+>/)?.[0]);
console.log('Hreflangs:', jaBlog.match(/<link rel="alternate" hreflang="[^"]+"[^>]+>/g));

console.log('\n=== 4. Checking blog/블로그-개요.html ===');
const exists = fs.existsSync('.vitepress/dist/blog/블로그-개요.html');
console.log('Exists in dist:', exists);
if (exists) {
  const koBlogOverview = fs.readFileSync('.vitepress/dist/blog/블로그-개요.html', 'utf8');
  console.log('KO Overview Canonical:', koBlogOverview.match(/<link rel="canonical"[^>]+>/)?.[0]);
  console.log('KO Overview Hreflangs:', koBlogOverview.match(/<link rel="alternate" hreflang="[^"]+"[^>]+>/g));
}

console.log('\n=== 5. Checking Tag nofollow in post ===');
const samplePost = fs.readFileSync('.vitepress/dist/tech/VitePress-다국어-블로그-구축기.html', 'utf8');
const tagLinks = samplePost.match(/<a [^>]*href="[^"]*tags\?tag=[^"]*"[^>]*>/g);
console.log('Found tag links with rel:\n', tagLinks?.slice(0, 3).join('\n'));

console.log('\n=== 6. Checking sitemap.xml for lastmod & trailing slashes ===');
const sitemap = fs.readFileSync('.vitepress/dist/sitemap.xml', 'utf8');
console.log('Has <lastmod>:', sitemap.includes('<lastmod>'));
const sampleUrls = sitemap.match(/<url>[\s\S]*?<\/url>/g)?.slice(0, 3);
console.log('Sample sitemap URL entries:\n', sampleUrls?.join('\n'));

console.log('\n=== 7. Checking Renamed Nike File ===');
const nikeExists = fs.existsSync('.vitepress/dist/blog/AI는 니케를 잘 모른다.html');
const oldNikeExists = fs.existsSync('.vitepress/dist/blog/AI는 니케를 잘 모른다..html');
console.log('Clean Nike file exists:', nikeExists, '| Old double-dot exists:', oldNikeExists);
