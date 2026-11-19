// アプリ内の規約類（src/content/legal.ts）を、Web 公開用の Markdown として書き出す。
// ストア審査ではプライバシーポリシーの URL が必要なため、この出力を静的サイトなどで公開する。
// 実行: node scripts/export-legal.mts
import { writeFileSync } from 'node:fs';

import { LEGAL_DOCS, LEGAL_DOCS_ARE_DRAFT } from '../src/content/legal.ts';

for (const [id, doc] of Object.entries(LEGAL_DOCS)) {
  const lines = [`# ${doc.title}`, '', `最終更新: ${doc.updated}`, ''];
  if (LEGAL_DOCS_ARE_DRAFT) lines.push('> 下書きです。公開前に内容の確認が必要です。', '');
  for (const s of doc.sections)
    lines.push(`## ${s.heading}`, '', s.body.replace(/\n/g, '  \n'), '');
  writeFileSync(new URL(`../docs/legal/${id}.md`, import.meta.url), lines.join('\n'));
}
console.log('docs/legal/ に書き出しました');
