#!/usr/bin/env node
/**
 * 블로그 게시글 간편 삭제 및 비공개 전환 CLI 스크립트
 * 사용법:
 *   npm run post:delete
 *   npm run post:delete -- "검색어"
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT_DIR = path.resolve(__dirname, '..');
const FOLDERS = ['tech', 'blog'];
const LANG_PREFIXES = ['', 'en/', 'ja/'];
const INDEX_FILES = ['tech/index.md', 'en/tech/index.md', 'ja/tech/index.md'];

function collectPosts(keyword = '') {
  const posts = [];
  const kw = keyword.trim().toLowerCase();

  for (const folder of FOLDERS) {
    const dirPath = path.join(ROOT_DIR, folder);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md') && f !== 'index.md');
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const titleMatch = content.match(/^title:\s*["']?([^"'\r\n]+)["']?/m);
      const dateMatch = content.match(/^date:\s*([^\r\n]+)/m);
      const isDraft = /^draft:\s*true/im.test(content);

      const title = titleMatch ? titleMatch[1].trim() : file.replace(/\.md$/, '');
      const date = dateMatch ? dateMatch[1].trim() : '';

      if (!kw || file.toLowerCase().includes(kw) || title.toLowerCase().includes(kw)) {
        posts.push({ folder, filename: file, title, date, isDraft });
      }
    }
  }

  posts.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.filename.localeCompare(a.filename));
  return posts;
}

function removeRowFromTechIndex(filename) {
  const encodedLink = `./${encodeURIComponent(filename)}`;
  const rawLink = `./${filename}`;
  const updatedIndexes = [];

  for (const relIndex of INDEX_FILES) {
    const idxPath = path.join(ROOT_DIR, relIndex);
    if (!fs.existsSync(idxPath)) continue;

    const content = fs.readFileSync(idxPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const filtered = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|')) return true;
      return !(line.includes(encodedLink) || line.includes(rawLink) || line.includes(`(${filename})`));
    });

    if (filtered.length !== lines.length) {
      fs.writeFileSync(idxPath, filtered.join('\n'), 'utf-8');
      updatedIndexes.push(relIndex);
    }
  }
  return updatedIndexes;
}

function extractImagePaths(markdownText) {
  const matches = [...markdownText.matchAll(/\(\/images\/([^)\s"']+)/g)];
  return [...new Set(matches.map(m => `public/images/${m[1]}`))];
}

function deletePost({ folder, filename }) {
  const deletedFiles = [];
  let koContent = '';

  for (const prefix of LANG_PREFIXES) {
    const relPath = `${prefix}${folder}/${filename}`;
    const fullPath = path.join(ROOT_DIR, relPath);
    if (fs.existsSync(fullPath)) {
      if (prefix === '') {
        koContent = fs.readFileSync(fullPath, 'utf-8');
      }
      fs.unlinkSync(fullPath);
      deletedFiles.push(relPath);
    }
  }

  // 본문 내 첨부 이미지 정리
  if (koContent) {
    const imgPaths = extractImagePaths(koContent);
    for (const relImg of imgPaths) {
      const fullImg = path.join(ROOT_DIR, relImg);
      if (fs.existsSync(fullImg)) {
        fs.unlinkSync(fullImg);
        deletedFiles.push(relImg);
      }
    }
  }

  // tech/index.md 3개 국어 표 행 정리
  let updatedIndexes = [];
  if (folder === 'tech') {
    updatedIndexes = removeRowFromTechIndex(filename);
  }

  return { deletedFiles, updatedIndexes };
}

function unpublishPost({ folder, filename }) {
  const updatedFiles = [];

  for (const prefix of LANG_PREFIXES) {
    const relPath = `${prefix}${folder}/${filename}`;
    const fullPath = path.join(ROOT_DIR, relPath);
    if (!fs.existsSync(fullPath)) continue;

    let content = fs.readFileSync(fullPath, 'utf-8');
    if (!/^draft:\s*true/im.test(content)) {
      if (/^draft:\s*false/im.test(content)) {
        content = content.replace(/^draft:\s*false/im, 'draft: true');
      } else if (content.startsWith('---')) {
        const parts = content.split('---');
        if (parts.length >= 3) {
          content = `---${parts[1]}\ndraft: true\n---${parts.slice(2).join('---')}`;
        }
      } else {
        content = `---\ndraft: true\n---\n\n${content}`;
      }
      fs.writeFileSync(fullPath, content, 'utf-8');
      updatedFiles.push(relPath);
    }
  }

  let updatedIndexes = [];
  if (folder === 'tech') {
    updatedIndexes = removeRowFromTechIndex(filename);
  }

  return { updatedFiles, updatedIndexes };
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

async function main() {
  const keyword = process.argv.slice(2).join(' ');
  const posts = collectPosts(keyword);

  if (posts.length === 0) {
    console.log(keyword ? `\n⚠️ '${keyword}' 검색 결과가 없습니다.` : '\n⚠️ 게시글이 없습니다.');
    process.exit(0);
  }

  console.log('\n📋 [블로그 게시글 목록 (KO/EN/JA 통합 관리)]');
  console.log('─'.repeat(75));
  posts.forEach((p, idx) => {
    const num = String(idx + 1).padStart(2, ' ');
    const badge = p.folder === 'tech' ? '[Tech]' : '[Blog]';
    const draftTag = p.isDraft ? ' (🙈 비공개 초안)' : '';
    const dateStr = p.date ? ` (${p.date})` : '';
    console.log(` ${num}. ${badge} ${p.title}${dateStr}${draftTag}`);
    console.log(`     └─ ${p.folder}/${p.filename}`);
  });
  console.log('─'.repeat(75));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const numStr = await ask(rl, '\n👉 관리할 게시글 번호를 입력하세요 (취소: Enter 또는 q): ');
    if (!numStr || numStr.toLowerCase() === 'q') {
      console.log('취소되었습니다.');
      return;
    }

    const index = parseInt(numStr, 10) - 1;
    if (isNaN(index) || index < 0 || index >= posts.length) {
      console.log('❌ 올바르지 않은 번호입니다.');
      return;
    }

    const selected = posts[index];
    console.log(`\n📌 선택된 글: [${selected.folder}] ${selected.title} (${selected.filename})`);
    console.log('  [1] 🗑️ 영구 삭제 (KO/EN/JA 파일 + tech/index.md 색인 행 + 첨부 이미지 일괄 삭제)');
    console.log('  [2] 🙈 비공개 전환 (KO/EN/JA 파일에 draft: true 설정 및 색인 제외)');
    console.log('  [0] ❌ 취소');

    const action = await ask(rl, '\n👉 실행할 작업 번호를 선택하세요 [1/2/0]: ');

    if (action === '1') {
      const confirm = await ask(rl, `⚠️ 정말로 '${selected.filename}' 글을 3개 언어에서 영구 삭제할까요? (y/N): `);
      if (confirm.toLowerCase() !== 'y') {
        console.log('삭제가 취소되었습니다.');
        return;
      }
      const { deletedFiles, updatedIndexes } = deletePost(selected);
      console.log('\n✅ 영구 삭제 완료!');
      deletedFiles.forEach(f => console.log(`  🗑️ 삭제됨: ${f}`));
      updatedIndexes.forEach(idx => console.log(`  📝 인덱스 행 제거됨: ${idx}`));
    } else if (action === '2') {
      const { updatedFiles, updatedIndexes } = unpublishPost(selected);
      console.log('\n✅ 비공개(draft: true) 전환 완료!');
      updatedFiles.forEach(f => console.log(`  🙈 비공개 적용됨: ${f}`));
      updatedIndexes.forEach(idx => console.log(`  📝 인덱스 행 제거됨: ${idx}`));
    } else {
      console.log('취소되었습니다.');
    }
  } finally {
    rl.close();
  }
}

main();

