/**
 * 把 src/ 下的片段拼成发行用的单文件 client.js。
 *
 * 为什么是"拼接"而不是模块表：
 *   client.js 整体跑在 ModuleLoader 的 factory 闭包里，所有片段本来就共享
 *   同一套闭包变量（h、React、serviceOf、tSafe、CSS ……）。改成各文件独立
 *   的模块作用域需要给每个跨文件引用加显式 import/export，等于重写一遍，
 *   而本机没有 esbuild/rollup，改坏了没有编译期兜底。按顺序拼接：
 *     - 语义与拆分前完全一致（同一闭包、同一声明顺序）；
 *     - 收益一样（改代码看的是 src/ 里的小文件）；
 *     - 新增/删除文件只改下面的 ORDER。
 *
 * 安全阀：拼装完先跑 node --check，再跑冒烟测试；任一失败就不写 client.js。
 *
 * 用法：
 *   node packages/dsh-sidebar-finder/scripts/build.mjs          正常构建
 *   node packages/dsh-sidebar-finder/scripts/build.mjs --check  只校验，不写文件
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..');
const SRC = path.join(PKG, 'src');
const OUT = path.join(PKG, 'client.js');

/**
 * 拼装顺序 —— 就是声明顺序。后面的片段可以用前面定义的任何东西，
 * 反之不行（和拆分前完全一样）。
 */
const ORDER = [
  '00-head.js',
  '10-constants.js',
  '20-dict.js',
  '30-open-state.js',
  '40-icon.js',
  '50-measure.js',
  '60-overlay-helpers.js',
  '65-header-entry.js',
  '70-overlay.js',
  '75-fs-search.js',
  '80-msg-search.js',
  '85-t-safe.js',
  '90-css.js',
  '92-runtime-vars.js',
  '94-fallback-panel.js',
  '96-collapse.js',
  '99-plugin.js',
];

const checkOnly = process.argv.includes('--check');

// ---------- 1. 读片段 ----------
const missing = ORDER.filter((f) => !fs.existsSync(path.join(SRC, f)));
if (missing.length) {
  console.error('✗ src/ 里缺少片段：\n  ' + missing.join('\n  '));
  process.exit(1);
}
// src/ 里有文件没列进 ORDER 就是漏掉了，必须报错，否则会静默丢代码
const onDisk = fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
const notListed = onDisk.filter((f) => !ORDER.includes(f));
if (notListed.length) {
  console.error('✗ src/ 里有片段没列进 ORDER（会丢代码）：\n  ' + notListed.join('\n  '));
  process.exit(1);
}

/** 去掉每片开头的 `/* xxx —— 原 client.js 第 a–b 行 *\/` 说明行 */
function stripHeader(text) {
  return text.replace(/^\/\*[^\n]*原 client\.js 第 \d+–\d+ 行[^\n]*\*\/\n/, '');
}

const pieces = ORDER.map((name) => {
  const raw = fs.readFileSync(path.join(SRC, name), 'utf8');
  return { name, body: stripHeader(raw) };
});

// ---------- 2. 拼装 ----------
// 每片自带结尾换行，直接相连即可还原原始行结构
let code = pieces.map((p) => p.body).join('');

// ---------- 3. 校验 ----------
const tmp = path.join(PKG, '.client.build.tmp.js');
fs.writeFileSync(tmp, code, 'utf8');

function fail(msg) {
  console.error('✗ ' + msg);
  console.error('  client.js 未被修改。');
  try { fs.rmSync(tmp, { force: true }); } catch { /* 忽略 */ }
  process.exit(1);
}

try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  console.log('✓ 语法检查通过');
} catch (e) {
  fail('语法检查失败：\n' + String(e.stderr || e.message));
}

// 冒烟测试：脚本里写死了 packages/dsh-sidebar-finder/client.js 这个路径，
// 所以先在临时文件上做语法层校验，再用环境变量把拼装结果喂给冒烟脚本。
const smoke = path.resolve(PKG, '../../_tmp/smoke-client.mjs');
if (fs.existsSync(smoke)) {
  try {
    execFileSync(process.execPath, [smoke], {
      stdio: 'pipe',
      env: { ...process.env, WF_CLIENT_OVERRIDE: tmp },
    });
    console.log('✓ 冒烟测试通过');
  } catch (e) {
    fail('冒烟测试失败：\n' + String(e.stdout || '') + String(e.stderr || e.message));
  }
} else {
  console.warn('! 未找到冒烟测试脚本，跳过（' + smoke + '）');
}

// ---------- 4. 落盘 ----------
if (checkOnly) {
  try { fs.rmSync(tmp, { force: true }); } catch { /* 忽略 */ }
  console.log('✓ --check：校验全部通过，未写入 client.js');
  process.exit(0);
}

fs.renameSync(tmp, OUT);
const lineCount = code.split('\n').length - (code.endsWith('\n') ? 1 : 0);
console.log(`✓ 已写入 client.js（${pieces.length} 片拼成，${lineCount} 行，${Buffer.byteLength(code)} 字节）`);
