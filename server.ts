import express from 'express';
import crypto from 'crypto';
import os from 'os';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { PDFDocument, degrees } from 'pdf-lib';
import sharp from 'sharp';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';
import dotenv from 'dotenv';
import ytdl from '@distube/ytdl-core';
import axios from 'axios';
import contentDisposition from 'content-disposition';
import * as mysql from 'mysql2/promise';
import Database from 'better-sqlite3';
import { spawn } from 'child_process';
import vm from 'vm';

dotenv.config();

const app = express();
const BASE_PORT = Number(process.env.PORT) || 3015;
let activePort = BASE_PORT;
const IS_WINDOWS = process.platform === 'win32';
const PYTHON_BIN =
  process.env.PYTHON_BIN || (IS_WINDOWS ? 'python' : 'python3');
const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg';
const POWERSHELL_BIN = process.env.POWERSHELL_BIN || 'powershell.exe';
const LIBREOFFICE_BIN = process.env.LIBREOFFICE_BIN || 'libreoffice';

const getLanUrls = (port: number) => {
  const urls = new Set<string>();
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (!entry || entry.family !== 'IPv4' || entry.internal) continue;
      urls.add(`http://${entry.address}:${port}`);
    }
  }

  return Array.from(urls);
};

// Allowed CORS origins — whitelist only known hosts
const PROD_ORIGINS = new Set(['https://www.vinzatools.com', 'https://vinzatools.com']);
const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true; // server-to-server requests have no Origin header
  if (PROD_ORIGINS.has(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.hf\.space$/.test(origin)) return true;   // HF Space deployments
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true; // Vercel preview URLs
  if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
};

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    callback(isAllowedOrigin(origin) ? null : new Error('Not allowed by CORS'), isAllowedOrigin(origin));
  },
  credentials: true,
}));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer setup for file uploads — 100 MB hard cap per file
const upload = multer({ dest: 'uploads/', limits: { fileSize: 100 * 1024 * 1024 } });

// Simple in-memory rate limiter (resets on server restart; good enough for abuse prevention)
const _rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const _rateLimitCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of _rateLimitStore) {
    if (now > val.resetAt) _rateLimitStore.delete(key);
  }
}, 60_000);
if (typeof _rateLimitCleanup.unref === 'function') _rateLimitCleanup.unref();

const rateLimit =
  (maxRequests: number, windowMs: number) =>
  (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const now = Date.now();
    const entry = _rateLimitStore.get(ip);
    if (!entry || now > entry.resetAt) {
      _rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > maxRequests) {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }
    next();
  };

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
const uploadsDir = path.resolve('uploads');
const shopifyThemesRoot = path.resolve('themes');
const sqliteDbPath = path.resolve('downloads.db');

if (!fs.existsSync(shopifyThemesRoot)) {
  fs.mkdirSync(shopifyThemesRoot, { recursive: true });
}

const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const RETIRED_THEME_IDS = new Set(['aura-modern---premium-e-commerce-theme']);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, port: activePort });
});

app.post('/api/fetch-html', async (req, res) => {
  let { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('.')) {
      throw new Error('Invalid URL');
    }
  } catch {
    return res
      .status(400)
      .json({ error: 'Invalid URL format. Use a full product link.' });
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 20000,
      maxRedirects: 5,
    });

    res.json({ html: response.data });
  } catch (error: any) {
    let message =
      'Failed to fetch URL content. Make sure the product page is public.';

    if (error?.code === 'ENOTFOUND' || error?.code === 'EAI_AGAIN') {
      message = 'Domain not found. Please check the product link.';
    } else if (error?.code === 'ECONNABORTED') {
      message =
        'Request timed out. The website may be slow or blocking requests.';
    } else if (error?.response?.status === 403) {
      message =
        'This website blocked automated access (403). Try another public product page.';
    } else if (error?.response?.status === 404) {
      message = 'Page not found (404). Please verify the product link.';
    }

    res.status(500).json({ error: message });
  }
});

const shouldIgnoreThemeEntry = (entryPath: string) => {
  const normalized = entryPath.replace(/\\/g, '/');
  return (
    normalized.includes('/node_modules/') ||
    normalized.startsWith('node_modules/') ||
    normalized.includes('/.git/') ||
    normalized.startsWith('.git/')
  );
};

const walkThemeFiles = (rootDir: string) => {
  const results: string[] = [];
  const queue = [rootDir];

  while (queue.length) {
    const currentDir = queue.shift()!;
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path
        .relative(rootDir, absolutePath)
        .replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (shouldIgnoreThemeEntry(relativePath)) continue;
        queue.push(absolutePath);
        continue;
      }

      if (!shouldIgnoreThemeEntry(relativePath)) {
        results.push(relativePath);
      }
    }
  }

  return results;
};

const getShopifyThemePreviewFiles = (themePath: string) => {
  const preferred = [
    'layout/theme.liquid',
    'theme.html',
    'templates/index.json',
    'templates/product.json',
    'config/settings_data.json',
    'config/settings_schema.json',
    'assets/base.css',
    'assets/theme.css',
    'sections/header.liquid',
    'src/App.tsx',
    'src/index.css',
    'index.html',
    'package.json',
  ];

  const foundPreferred = preferred.filter((relativePath) =>
    fs.existsSync(path.join(themePath, relativePath))
  );

  if (foundPreferred.length) return foundPreferred.slice(0, 6);

  return walkThemeFiles(themePath)
    .filter(
      (entry) =>
        /\.(liquid|json|css|js|html|ts|tsx)$/i.test(entry) &&
        !entry.includes('.git') &&
        !entry.includes('node_modules')
    )
    .slice(0, 6);
};

type ShopifyThemeSummary = {
  id: string;
  name: string;
  description?: string;
  relativePath: string;
  fileCount: number;
  previewFiles: string[];
  hasPreview: boolean;
  canBuildPreview: boolean;
};

const getThemeFiles = (themePath: string) => walkThemeFiles(themePath);

const getThemePreviewRoot = (themePath: string) => {
  const distRoot = path.join(themePath, 'dist');
  if (fs.existsSync(path.join(distRoot, 'index.html'))) {
    return distRoot;
  }
  if (fs.existsSync(path.join(themePath, 'theme.html'))) {
    return themePath;
  }
  if (fs.existsSync(path.join(themePath, 'index.html'))) {
    return themePath;
  }
  return null;
};

const getThemePreviewEntry = (themePath: string) => {
  const distRoot = path.join(themePath, 'dist');
  if (fs.existsSync(path.join(distRoot, 'index.html'))) {
    return 'index.html';
  }
  if (fs.existsSync(path.join(themePath, 'theme.html'))) {
    return 'theme.html';
  }
  return 'index.html';
};

const scanShopifyThemes = (): ShopifyThemeSummary[] => {
  if (!fs.existsSync(shopifyThemesRoot)) {
    return [];
  }

  const entries = fs
    .readdirSync(shopifyThemesRoot, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && !RETIRED_THEME_IDS.has(entry.name)
    );

  return entries.map((entry) => {
    const themePath = path.join(shopifyThemesRoot, entry.name);
    const recursiveFiles = getThemeFiles(themePath);
    const hasPreview = Boolean(getThemePreviewRoot(themePath));
    const hasBuildSource = fs.existsSync(path.join(themePath, 'package.json'));
    const metadataPath = path.join(themePath, 'metadata.json');
    const metadata = fs.existsSync(metadataPath)
      ? JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
      : null;

    return {
      id: entry.name,
      name: metadata?.name || entry.name.replace(/[-_]+/g, ' '),
      description: metadata?.description || '',
      relativePath: path.relative(process.cwd(), themePath),
      fileCount: recursiveFiles.length,
      previewFiles: getShopifyThemePreviewFiles(themePath),
      hasPreview,
      canBuildPreview: hasBuildSource || hasPreview,
    };
  });
};

const runThemeProcess = (command: string, args: string[], cwd: string) =>
  new Promise<void>((resolve, reject) => {
    const spawnCommand =
      process.platform === 'win32' && /npm(\.cmd)?$/i.test(command)
        ? 'cmd.exe'
        : command;
    const spawnArgs =
      process.platform === 'win32' && /npm(\.cmd)?$/i.test(command)
        ? ['/d', '/s', '/c', 'npm', ...args]
        : args;

    const child = spawn(spawnCommand, spawnArgs, {
      cwd,
      env: process.env,
      shell: false,
      windowsHide: true,
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(stderr.trim() || `${command} ${args.join(' ')} failed`)
        );
      }
    });
  });

const buildThemePreview = async (themeRoot: string) => {
  const distIndexPath = path.join(themeRoot, 'dist', 'index.html');
  if (fs.existsSync(distIndexPath)) {
    return;
  }

  const packageJsonPath = path.join(themeRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const nodeModulesPath = path.join(themeRoot, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      await runThemeProcess(npmExecutable, ['install'], themeRoot);
    }

    await runThemeProcess(npmExecutable, ['run', 'build'], themeRoot);

    if (!fs.existsSync(distIndexPath)) {
      throw new Error(
        'Theme build completed but dist/index.html was not created.'
      );
    }
    return;
  }

  if (fs.existsSync(path.join(themeRoot, 'index.html'))) {
    return;
  }

  throw new Error('This theme folder does not contain a usable preview entry.');
};

const previewLogoPath = path.resolve(
  'src',
  'assets',
  'logos',
  'toolora-logo.png'
);
const previewLogoDataUri = fs.existsSync(previewLogoPath)
  ? `data:image/png;base64,${fs.readFileSync(previewLogoPath).toString('base64')}`
  : '';

const injectPreviewBranding = (html: string, _themeId: string) => html;

app.get('/api/shopify/themes', async (_req, res) => {
  try {
    const themes = scanShopifyThemes();
    await syncThemeLibraryToDb(themes);
    res.json({ themes });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to scan themes' });
  }
});

app.post('/api/shopify/themes/:themeId/prepare-preview', async (req, res) => {
  try {
    const themeId = String(req.params.themeId || '').trim();
    if (!themeId) {
      return res.status(400).json({ error: 'Theme id is required' });
    }
    if (isRetiredTheme(themeId)) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    const themeRoot = path.join(shopifyThemesRoot, themeId);
    if (!fs.existsSync(themeRoot) || !fs.statSync(themeRoot).isDirectory()) {
      return res.status(404).json({ error: 'Theme folder not found' });
    }

    await buildThemePreview(themeRoot);
    await trackThemeActivity(req, themeId, 'prepare_preview');
    res.json({
      success: true,
      previewUrl: `/theme-preview/${encodeURIComponent(themeId)}/`,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error?.message || 'Failed to prepare live preview',
    });
  }
});

app.get('/api/shopify/themes/:themeId/file', async (req, res) => {
  try {
    const themeId = String(req.params.themeId || '').trim();
    const requestedPath = String(req.query.path || '').trim();
    if (!themeId || !requestedPath) {
      return res
        .status(400)
        .json({ error: 'Theme and file path are required' });
    }
    if (isRetiredTheme(themeId)) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    const themeRoot = path.join(shopifyThemesRoot, themeId);
    const absoluteTarget = path.resolve(themeRoot, requestedPath);

    if (!absoluteTarget.startsWith(themeRoot)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    if (
      !fs.existsSync(absoluteTarget) ||
      fs.statSync(absoluteTarget).isDirectory()
    ) {
      return res.status(404).json({ error: 'Theme file not found' });
    }

    const content = fs.readFileSync(absoluteTarget, 'utf8');
    res.json({
      path: requestedPath,
      content: content.slice(0, 120000),
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error?.message || 'Failed to open theme file' });
  }
});

app.get('/api/shopify/themes/:themeId/download', async (req, res) => {
  try {
    const themeId = String(req.params.themeId || '').trim();
    if (!themeId) {
      return res.status(400).json({ error: 'Theme id is required' });
    }
    if (isRetiredTheme(themeId)) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    const themeRoot = path.join(shopifyThemesRoot, themeId);
    if (!fs.existsSync(themeRoot) || !fs.statSync(themeRoot).isDirectory()) {
      return res.status(404).json({ error: 'Theme folder not found' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', contentDisposition(`${themeId}.zip`));
    await trackThemeActivity(req, themeId, 'download');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: err.message || 'Failed to build theme zip' });
      } else {
        res.end();
      }
    });
    archive.pipe(res);
    archive.glob(
      '**/*',
      {
        cwd: themeRoot,
        dot: true,
        ignore: ['node_modules/**', '.git/**'],
      },
      { prefix: themeId }
    );
    await archive.finalize();
  } catch (error: any) {
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: error?.message || 'Failed to download theme' });
    }
  }
});

app.get(['/assets/*', '/src/assets/*'], (req, res, next) => {
  const referer = String(req.get('referer') || '');
  const match = referer.match(/\/theme-preview\/([^/?#]+)/);
  if (!match) {
    return next();
  }

  const themeId = decodeURIComponent(match[1]);
  const themeRoot = path.join(shopifyThemesRoot, themeId);
  const previewRoot = getThemePreviewRoot(themeRoot);
  const previewEntry = getThemePreviewEntry(themeRoot);
  if (!previewRoot) {
    return next();
  }

  const normalizedRequestPath = req.path
    .replace(/^\/src\/assets\//, 'assets/')
    .replace(/^\//, '');
  const absoluteTarget = path.resolve(previewRoot, normalizedRequestPath);

  if (!absoluteTarget.startsWith(previewRoot)) {
    return next();
  }

  if (!fs.existsSync(absoluteTarget) || !fs.statSync(absoluteTarget).isFile()) {
    return next();
  }

  return res.sendFile(absoluteTarget);
});

app.get('/theme-preview/:themeId', async (req, res) => {
  try {
    const themeId = String(req.params.themeId || '').trim();
    if (!themeId) {
      return res.status(400).send('Theme id is required');
    }
    if (isRetiredTheme(themeId)) {
      return res.status(404).send('Theme not found');
    }

    const themeRoot = path.join(shopifyThemesRoot, themeId);
    const previewRoot = getThemePreviewRoot(themeRoot);
    const previewEntry = getThemePreviewEntry(themeRoot);
    if (!previewRoot) {
      return res
        .status(404)
        .send('Preview not ready yet. Use Prepare Preview on the Themes page.');
    }

    const previewBase = `/theme-preview/${encodeURIComponent(themeId)}`;
    const html = fs.readFileSync(path.join(previewRoot, previewEntry), 'utf8');
    void trackThemeActivity(req, themeId, 'open_preview');
    return res.type('html').send(
      injectPreviewBranding(
        html
          .replace(/(["'])\/assets\//g, `$1${previewBase}/assets/`)
          .replace(/(["'])\.\/assets\//g, `$1${previewBase}/assets/`)
          .replace(/(["'])assets\//g, `$1${previewBase}/assets/`)
          .replace(/(["'])\/favicon\.ico/g, `$1${previewBase}/favicon.ico`)
          .replace(/(["'])\/vite\.svg/g, `$1${previewBase}/vite.svg`),
        themeId
      )
    );
  } catch (error: any) {
    return res.status(500).send(error?.message || 'Failed to open preview');
  }
});

app.get('/theme-preview/:themeId/*', async (req, res) => {
  try {
    const themeId = String(req.params.themeId || '').trim();
    if (isRetiredTheme(themeId)) {
      return res.status(404).send('Theme not found');
    }
    const themeRoot = path.join(shopifyThemesRoot, themeId);
    const previewRoot = getThemePreviewRoot(themeRoot);
    const previewEntry = getThemePreviewEntry(themeRoot);
    if (!previewRoot) {
      return res
        .status(404)
        .send('Preview not ready yet. Use Prepare Preview on the Themes page.');
    }

    const wildcardPath = Array.isArray(req.params[0])
      ? req.params[0].join('/')
      : String(req.params[0] || '').trim();
    const requested = wildcardPath || previewEntry;
    const absoluteTarget = path.resolve(previewRoot, requested);

    if (!absoluteTarget.startsWith(previewRoot)) {
      return res.status(400).send('Invalid preview path');
    }

    const previewBase = `/theme-preview/${encodeURIComponent(themeId)}`;
    const rewritePreviewHtml = (html: string) =>
      injectPreviewBranding(
        html
          .replace(/(["'])\/assets\//g, `$1${previewBase}/assets/`)
          .replace(/(["'])\.\/assets\//g, `$1${previewBase}/assets/`)
          .replace(/(["'])assets\//g, `$1${previewBase}/assets/`)
          .replace(/(["'])\/favicon\.ico/g, `$1${previewBase}/favicon.ico`)
          .replace(/(["'])\/vite\.svg/g, `$1${previewBase}/vite.svg`),
        themeId
      );

    if (fs.existsSync(absoluteTarget) && fs.statSync(absoluteTarget).isFile()) {
      if (absoluteTarget.endsWith('.html')) {
        void trackThemeActivity(req, themeId, 'preview_view');
        const html = fs.readFileSync(absoluteTarget, 'utf8');
        return res.type('html').send(rewritePreviewHtml(html));
      }
      return res.sendFile(absoluteTarget);
    }

    void trackThemeActivity(req, themeId, 'preview_view');
    const html = fs.readFileSync(path.join(previewRoot, previewEntry), 'utf8');
    return res.type('html').send(rewritePreviewHtml(html));
  } catch (error: any) {
    return res.status(500).send(error?.message || 'Failed to open preview');
  }
});

// MySQL database (XAMPP)
const MYSQL_HOST = (process.env.MYSQL_HOST || '127.0.0.1').trim();
const MYSQL_USER = (process.env.MYSQL_USER || 'root').trim();
const MYSQL_PASSWORD = (process.env.MYSQL_PASSWORD || '').trim();
const MYSQL_DATABASE = (process.env.MYSQL_DATABASE || 'toolora_db').trim();
const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306);
let db: mysql.Pool | null = null;
let sqliteDb: Database.Database | null = null;
let databaseMode: 'mysql' | 'sqlite' = 'sqlite';

const ensureSqliteColumn = (
  table: string,
  column: string,
  definition: string
) => {
  if (!sqliteDb) return;
  const columns = sqliteDb
    .prepare(`PRAGMA table_info(\`${table}\`)`)
    .all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    sqliteDb.exec(
      `ALTER TABLE \`${table}\` ADD COLUMN ${column} ${definition}`
    );
  }
};

const initSqliteFallback = () => {
  sqliteDb = new Database(sqliteDbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      thumbnail TEXT,
      url TEXT,
      tool TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tool_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_id TEXT,
      sub_action TEXT,
      client_id TEXT,
      user_agent TEXT,
      ip TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      phone TEXT,
      subject TEXT,
      message TEXT,
      category TEXT,
      reply_status TEXT DEFAULT 'pending',
      last_reply_channel TEXT,
      last_reply_text TEXT,
      replied_at TEXT,
      ip TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS theme_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      theme_id TEXT,
      action_name TEXT,
      ip TEXT,
      user_agent TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS theme_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      theme_id TEXT UNIQUE,
      theme_name TEXT,
      relative_path TEXT,
      file_count INTEGER DEFAULT 0,
      preview_files_count INTEGER DEFAULT 0,
      has_preview INTEGER DEFAULT 0,
      can_build_preview INTEGER DEFAULT 0,
      last_synced TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  ensureSqliteColumn('contact_messages', 'ip', 'TEXT');
  ensureSqliteColumn('contact_messages', 'phone', 'TEXT');
  ensureSqliteColumn(
    'contact_messages',
    'reply_status',
    "TEXT DEFAULT 'pending'"
  );
  ensureSqliteColumn('contact_messages', 'last_reply_channel', 'TEXT');
  ensureSqliteColumn('contact_messages', 'last_reply_text', 'TEXT');
  ensureSqliteColumn('contact_messages', 'replied_at', 'TEXT');
  ensureSqliteColumn('tool_usage', 'ip', 'TEXT');
  ensureSqliteColumn('theme_activity', 'ip', 'TEXT');
  databaseMode = 'sqlite';
};

const initDb = async () => {
  const baseConfig = {
    host: MYSQL_HOST,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    port: MYSQL_PORT,
    multipleStatements: true,
  };

  try {
    const connection = await mysql.createConnection(baseConfig);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\``
    );
    await connection.end();

    db = mysql.createPool({
      ...baseConfig,
      database: MYSQL_DATABASE,
      connectionLimit: 10,
    });

    await db.query(`
      CREATE TABLE IF NOT EXISTS history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title TEXT,
        thumbnail TEXT,
        url TEXT,
        tool TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS tool_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tool_id TEXT,
        sub_action TEXT,
        client_id TEXT,
        user_agent TEXT,
        ip TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name TEXT,
        email TEXT,
        phone TEXT,
        subject TEXT,
        message TEXT,
        category TEXT,
        reply_status TEXT,
        last_reply_channel TEXT,
        last_reply_text TEXT,
        replied_at TEXT,
        ip TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS theme_activity (
        id INT AUTO_INCREMENT PRIMARY KEY,
        theme_id TEXT,
        action_name TEXT,
        ip TEXT,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS theme_library (
        id INT AUTO_INCREMENT PRIMARY KEY,
        theme_id VARCHAR(255) UNIQUE,
        theme_name TEXT,
        relative_path TEXT,
        file_count INT DEFAULT 0,
        preview_files_count INT DEFAULT 0,
        has_preview TINYINT(1) DEFAULT 0,
        can_build_preview TINYINT(1) DEFAULT 0,
        last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await db.query(
      `ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS ip TEXT`
    );
    await db.query(
      `ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS phone TEXT`
    );
    await db.query(
      `ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS reply_status TEXT`
    );
    await db.query(
      `ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS last_reply_channel TEXT`
    );
    await db.query(
      `ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS last_reply_text TEXT`
    );
    await db.query(
      `ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS replied_at TEXT`
    );
    await db.query(
      `UPDATE contact_messages SET reply_status = 'pending' WHERE reply_status IS NULL OR reply_status = ''`
    );
    databaseMode = 'mysql';
  } catch (error: any) {
    console.warn(
      `MySQL unavailable, switching to local SQLite fallback: ${error?.message || error}`
    );
    db = null;
    initSqliteFallback();
  }
};

const shouldFallbackToSqlite = (error: any) => {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR' ||
    code === 'PROTOCOL_ENQUEUE_AFTER_QUIT' ||
    message.includes('connection is in closed state') ||
    message.includes(
      "can't add new command when connection is in closed state"
    ) ||
    message.includes('connect econnrefused') ||
    message.includes('server has gone away')
  );
};

const dbQuery = async <T = any>(sql: string, params: any[] = []) => {
  if (databaseMode === 'mysql' && db) {
    try {
      const [rows] = await db.query(sql, params);
      return rows as T;
    } catch (error: any) {
      if (!shouldFallbackToSqlite(error)) {
        throw error;
      }

      console.warn(
        `MySQL query failed, switching to local SQLite fallback: ${error?.message || error}`
      );
      db = null;
      if (!sqliteDb) {
        initSqliteFallback();
      } else {
        databaseMode = 'sqlite';
      }
    }
  }

  if (!sqliteDb) {
    throw new Error('Database is not initialized');
  }

  const trimmed = sql.trim();
  const statement = sqliteDb.prepare(trimmed);
  if (/^(select|pragma)/i.test(trimmed)) {
    return statement.all(...params) as T;
  }
  return statement.run(...params) as T;
};

const ADMIN_PIN = (process.env.ADMIN_PIN || 'admin123').trim();
const ADMIN_USER = (process.env.ADMIN_USER || 'admin').trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'admin').trim();
const ADMIN_TOTP_SECRET = (process.env.ADMIN_TOTP_SECRET || '').trim();

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const decodeBase32 = (input: string) => {
  const cleaned = input
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '')
    .replace(/=+$/g, '');
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    buffer = (buffer << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

const generateTotp = (secret: string, counter: number) => {
  const key = decodeBase32(secret);
  if (!key.length) return '';
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
};

const verifyTotp = (token: string, secret: string) => {
  if (!token || token.length < 6) return false;
  const now = Math.floor(Date.now() / 1000 / 30);
  const window = [now - 1, now, now + 1];
  return window.some((counter) => generateTotp(secret, counter) === token);
};
const requireAdmin = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const pin = (req.headers['x-admin-pin'] || '').toString().trim();
  const user = (req.headers['x-admin-user'] || '').toString().trim();
  const pass = (req.headers['x-admin-pass'] || '').toString().trim();
  const otp = (req.headers['x-admin-otp'] || req.query.admin_otp || '')
    .toString()
    .trim();
  const queryUser = (req.query.admin_user || '').toString().trim();
  const queryPass = (req.query.admin_pass || '').toString().trim();
  const pinOk = pin && pin === ADMIN_PIN;
  const headerOk =
    user && pass && user === ADMIN_USER && pass === ADMIN_PASSWORD;
  const queryOk =
    queryUser &&
    queryPass &&
    queryUser === ADMIN_USER &&
    queryPass === ADMIN_PASSWORD;
  const userOk = headerOk || queryOk;
  if (!pinOk && !userOk) return res.status(401).json({ error: 'Unauthorized' });
  if (ADMIN_TOTP_SECRET) {
    const otpOk = verifyTotp(otp, ADMIN_TOTP_SECRET);
    if (!otpOk)
      return res.status(401).json({ error: 'Two-factor code required' });
  }
  next();
};

const getRequestIp = (req: express.Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) {
    return forwarded[0] || null;
  }
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || null;
};

const normalizeWhatsappPhone = (value: string) => value.replace(/[^\d]/g, '');

const trackThemeActivity = async (
  req: express.Request,
  themeId: string,
  actionName: string
) => {
  try {
    await dbQuery(
      'INSERT INTO theme_activity (theme_id, action_name, ip, user_agent) VALUES (?, ?, ?, ?)',
      [
        themeId,
        actionName,
        getRequestIp(req),
        (req.headers['user-agent'] || '').toString().slice(0, 500),
      ]
    );
  } catch (error) {
    console.error('Failed to track theme activity:', error);
  }
};

const isRetiredTheme = (themeId: string) =>
  RETIRED_THEME_IDS.has(String(themeId || '').trim());

const syncThemeLibraryToDb = async (themes: ShopifyThemeSummary[]) => {
  try {
    for (const theme of themes) {
      if (databaseMode === 'mysql') {
        await dbQuery(
          `INSERT INTO theme_library
            (theme_id, theme_name, relative_path, file_count, preview_files_count, has_preview, can_build_preview)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
            theme_name = VALUES(theme_name),
            relative_path = VALUES(relative_path),
            file_count = VALUES(file_count),
            preview_files_count = VALUES(preview_files_count),
            has_preview = VALUES(has_preview),
            can_build_preview = VALUES(can_build_preview)`,
          [
            theme.id,
            theme.name,
            theme.relativePath,
            Number(theme.fileCount || 0),
            Number(theme.previewFiles?.length || 0),
            theme.hasPreview ? 1 : 0,
            theme.canBuildPreview ? 1 : 0,
          ]
        );
      } else {
        await dbQuery(
          `INSERT INTO theme_library
            (theme_id, theme_name, relative_path, file_count, preview_files_count, has_preview, can_build_preview, last_synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(theme_id) DO UPDATE SET
            theme_name = excluded.theme_name,
            relative_path = excluded.relative_path,
            file_count = excluded.file_count,
            preview_files_count = excluded.preview_files_count,
            has_preview = excluded.has_preview,
            can_build_preview = excluded.can_build_preview,
            last_synced = CURRENT_TIMESTAMP`,
          [
            theme.id,
            theme.name,
            theme.relativePath,
            Number(theme.fileCount || 0),
            Number(theme.previewFiles?.length || 0),
            theme.hasPreview ? 1 : 0,
            theme.canBuildPreview ? 1 : 0,
          ]
        );
      }
    }

    const activeThemeIds = themes.map((theme) => theme.id);
    const retiredThemeIds = Array.from(RETIRED_THEME_IDS);

    if (databaseMode === 'mysql') {
      if (activeThemeIds.length) {
        const activePlaceholders = activeThemeIds.map(() => '?').join(', ');
        await dbQuery(
          `DELETE FROM theme_library WHERE theme_id NOT IN (${activePlaceholders})`,
          activeThemeIds
        );
      } else {
        await dbQuery('DELETE FROM theme_library');
      }

      if (retiredThemeIds.length) {
        const retiredPlaceholders = retiredThemeIds.map(() => '?').join(', ');
        await dbQuery(
          `DELETE FROM theme_library WHERE theme_id IN (${retiredPlaceholders})`,
          retiredThemeIds
        );
        await dbQuery(
          `DELETE FROM theme_activity WHERE theme_id IN (${retiredPlaceholders})`,
          retiredThemeIds
        );
      }
    } else {
      if (activeThemeIds.length) {
        const activePlaceholders = activeThemeIds.map(() => '?').join(', ');
        await dbQuery(
          `DELETE FROM theme_library WHERE theme_id NOT IN (${activePlaceholders})`,
          activeThemeIds
        );
      } else {
        await dbQuery('DELETE FROM theme_library');
      }

      if (retiredThemeIds.length) {
        const retiredPlaceholders = retiredThemeIds.map(() => '?').join(', ');
        await dbQuery(
          `DELETE FROM theme_library WHERE theme_id IN (${retiredPlaceholders})`,
          retiredThemeIds
        );
        await dbQuery(
          `DELETE FROM theme_activity WHERE theme_id IN (${retiredPlaceholders})`,
          retiredThemeIds
        );
      }
    }
  } catch (error) {
    console.error('Failed to sync theme library:', error);
  }
};

// --- PDF TOOLS API ---
const runProcess = (
  command: string,
  args: string[],
  options: { cwd?: string } = {}
) =>
  new Promise<void>((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
    });
    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `${command} failed with code ${code}`));
    });
  });

const runPowerShellScript = async (script: string, args: string[]) => {
  const scriptPath = path.join(
    uploadsDir,
    `office_${Date.now()}_${Math.random().toString(36).slice(2)}.ps1`
  );
  fs.writeFileSync(scriptPath, script, 'utf8');
  try {
    await runProcess(POWERSHELL_BIN, [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      ...args,
    ]);
  } finally {
    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath);
    }
  }
};

const runPythonScript = async (script: string, args: string[]) => {
  const scriptPath = path.join(
    uploadsDir,
    `pdf_${Date.now()}_${Math.random().toString(36).slice(2)}.py`
  );
  fs.writeFileSync(scriptPath, script, 'utf8');
  try {
    await runProcess(PYTHON_BIN, [scriptPath, ...args]);
  } finally {
    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath);
    }
  }
};

const runPythonFile = async (scriptPath: string, args: string[]) => {
  await runProcess(PYTHON_BIN, [scriptPath, ...args]);
};

const runLibreOfficeConvertToPdf = async (
  inputPath: string,
  outputPath: string
) => {
  const outputDir = path.dirname(outputPath);
  const expectedPdfPath = path.join(
    outputDir,
    `${path.basename(inputPath, path.extname(inputPath))}.pdf`
  );

  if (fs.existsSync(expectedPdfPath)) {
    fs.unlinkSync(expectedPdfPath);
  }

  await runProcess(LIBREOFFICE_BIN, [
    '--headless',
    '--nologo',
    '--nolockcheck',
    '--nodefault',
    '--nofirststartwizard',
    '--convert-to',
    'pdf',
    '--outdir',
    outputDir,
    inputPath,
  ]);

  if (!fs.existsSync(expectedPdfPath)) {
    throw new Error('LibreOffice did not create the converted PDF.');
  }

  if (expectedPdfPath !== outputPath) {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    fs.renameSync(expectedPdfPath, outputPath);
  }
};

const runPythonScriptJson = async <T = any>(script: string, args: string[]) => {
  const outputPath = path.join(
    uploadsDir,
    `python_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
  );
  await runPythonScript(script, [...args, outputPath]);
  try {
    const raw = fs.readFileSync(outputPath, 'utf8');
    return JSON.parse(raw) as T;
  } finally {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  }
};

const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
  label: string
) => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const cleanupPaths = (...pathsToDelete: Array<string | undefined>) => {
  for (const target of pathsToDelete) {
    if (!target || !fs.existsSync(target)) {
      continue;
    }

    try {
      fs.unlinkSync(target);
    } catch (error: any) {
      const code = error?.code;
      if (code === 'ENOENT') {
        continue;
      }

      if (code === 'EBUSY' || code === 'EPERM') {
        setTimeout(() => {
          fs.unlink(target, () => {
            // Ignore delayed cleanup failures from Office file locks.
          });
        }, 1500);
        continue;
      }

      console.warn(`Cleanup failed for ${target}:`, error?.message || error);
    }
  }
};

const removeNearWhiteBackground = async (
  inputPath: string,
  threshold = 238,
  tolerance = 24
) => {
  const source = sharp(inputPath).ensureAlpha();
  const { data, info } = await source
    .raw()
    .toBuffer({ resolveWithObject: true });

  const edge = Math.max(0, threshold - tolerance);
  const soft = Math.max(4, tolerance);

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = (r + g + b) / 3;
    const sat = max - min;

    if (lum >= threshold && sat <= tolerance) {
      data[i + 3] = 0;
    } else if (lum >= edge && sat <= tolerance * 1.5) {
      const alpha = Math.round((255 * (threshold - lum)) / soft);
      data[i + 3] = Math.max(0, Math.min(255, alpha));
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
};

const waitForFile = async (targetPath: string, timeoutMs = 3000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (fs.existsSync(targetPath)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return fs.existsSync(targetPath);
};

const waitForReadableFile = async (targetPath: string, timeoutMs = 6000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const fd = fs.openSync(targetPath, 'r');
      fs.closeSync(fd);
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  try {
    const fd = fs.openSync(targetPath, 'r');
    fs.closeSync(fd);
    return true;
  } catch {
    return false;
  }
};

const prepareUploadedSourcePath = (
  file: Express.Multer.File | undefined,
  fallbackExtension: string
) => {
  if (!file) return null;
  const originalExt = path.extname(file.originalname || '').trim();
  const ext = originalExt || fallbackExtension;
  const preparedPath = path.resolve(
    path.join('uploads', `${path.basename(file.path)}${ext}`)
  );
  fs.copyFileSync(file.path, preparedPath);
  return preparedPath;
};

const sendDownloadedFile = (
  res: express.Response,
  outputPath: string,
  downloadName: string,
  cleanup: string[] = []
) => {
  res.download(outputPath, downloadName, () => {
    cleanupPaths(outputPath, ...cleanup);
  });
};

const cleanupDirectory = (dirPath: string) => {
  if (!dirPath || !fs.existsSync(dirPath)) return;
  fs.rm(dirPath, { recursive: true, force: true }, () => {
    // ignore cleanup errors for temp folders
  });
};

const sanitizeFileStem = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'converted-file';

const parsePositiveNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const getMediaMimeType = (extension: string) => {
  const ext = extension.toLowerCase();
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'apng') return 'image/apng';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'ogg') return 'audio/ogg';
  if (ext === 'aac') return 'audio/aac';
  if (ext === 'zip') return 'application/zip';
  return 'application/octet-stream';
};

const buildVideoOutputArgs = (outputFormat: string) => {
  switch (outputFormat) {
    case 'mov':
      return [
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
      ];
    case 'webm':
      return [
        '-c:v',
        'libvpx-vp9',
        '-b:v',
        '0',
        '-crf',
        '32',
        '-c:a',
        'libopus',
      ];
    case 'mp4':
    default:
      return [
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
      ];
  }
};

app.post(
  '/api/media/transcode',
  upload.array('files', 24),
  async (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) {
      return res.status(400).json({ error: 'At least one file is required.' });
    }

    const preset = String(req.body.preset || '').trim();
    const outputFormat = String(req.body.outputFormat || 'mp4')
      .trim()
      .toLowerCase();
    const startTime = parsePositiveNumber(req.body.startTime, 0);
    const endTime = parsePositiveNumber(req.body.endTime, 0);
    const cropX = Math.round(parsePositiveNumber(req.body.cropX, 0));
    const cropY = Math.round(parsePositiveNumber(req.body.cropY, 0));
    const cropWidth = Math.max(
      2,
      Math.round(parsePositiveNumber(req.body.cropWidth, 720))
    );
    const cropHeight = Math.max(
      2,
      Math.round(parsePositiveNumber(req.body.cropHeight, 720))
    );
    const fps = Math.max(
      1,
      Math.min(30, Math.round(parsePositiveNumber(req.body.fps, 12)))
    );
    const imageDelay = Math.max(
      0.2,
      parsePositiveNumber(req.body.imageDelay, 2)
    );
    const jobDir = path.join(
      uploadsDir,
      `media_job_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );

    fs.mkdirSync(jobDir, { recursive: true });

    const cleanupJob = () => {
      cleanupPaths(...files.map((file) => file.path));
      cleanupDirectory(jobDir);
    };

    const primaryFile = files[0];
    const outputExt =
      preset === 'crop-video' || preset === 'trim-video'
        ? 'mp4'
        : outputFormat || 'mp4';
    const outputPath = path.join(
      jobDir,
      `${sanitizeFileStem(primaryFile.originalname)}-${preset}.${outputExt}`
    );

    try {
      let ffmpegArgs: string[] = [];

      const buildTimeArgs = () => {
        const args: string[] = [];
        if (startTime > 0) args.push('-ss', `${startTime}`);
        if (endTime > startTime) args.push('-to', `${endTime}`);
        return args;
      };

      if (preset === 'gif-maker' || preset === 'image-to-gif') {
        const concatPath = path.join(jobDir, 'frames.txt');
        const normalizedLines = files
          .map((file) => path.resolve(file.path).replace(/\\/g, '/'))
          .map(
            (filePath) =>
              `file '${filePath.replace(/'/g, "'\\''")}'\nduration ${imageDelay}`
          )
          .join('\n');
        const lastLine = path
          .resolve(files[files.length - 1].path)
          .replace(/\\/g, '/');
        fs.writeFileSync(
          concatPath,
          `${normalizedLines}\nfile '${lastLine.replace(/'/g, "'\\''")}'\n`,
          'utf8'
        );
        ffmpegArgs = [
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          concatPath,
          '-vf',
          `fps=${fps},scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos`,
          '-loop',
          '0',
          outputPath,
        ];
      } else {
        const inputPath = path.resolve(primaryFile.path);

        switch (preset) {
          case 'crop-video':
            ffmpegArgs = [
              '-y',
              '-i',
              inputPath,
              '-vf',
              `crop=${cropWidth}:${cropHeight}:${cropX}:${cropY}`,
              ...buildVideoOutputArgs('mp4'),
              outputPath,
            ];
            break;
          case 'trim-video':
            ffmpegArgs = [
              '-y',
              '-i',
              inputPath,
              ...buildTimeArgs(),
              ...buildVideoOutputArgs('mp4'),
              outputPath,
            ];
            break;
          case 'video-converter':
          case 'mp4-converter':
          case 'mov-to-mp4': {
            const resolvedFormat =
              preset === 'mov-to-mp4' || preset === 'mp4-converter'
                ? 'mp4'
                : outputFormat;
            if (resolvedFormat === 'gif') {
              ffmpegArgs = [
                '-y',
                '-i',
                inputPath,
                ...buildTimeArgs(),
                '-vf',
                `fps=${fps},scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos`,
                '-loop',
                '0',
                outputPath,
              ];
            } else {
              ffmpegArgs = [
                '-y',
                '-i',
                inputPath,
                ...buildTimeArgs(),
                ...buildVideoOutputArgs(resolvedFormat),
                outputPath,
              ];
            }
            break;
          }
          case 'audio-converter':
          case 'mp3-converter':
          case 'mp4-to-mp3':
          case 'video-to-mp3':
          case 'mp3-to-ogg': {
            const resolvedFormat =
              preset === 'mp4-to-mp3' ||
              preset === 'video-to-mp3' ||
              preset === 'mp3-converter'
                ? 'mp3'
                : preset === 'mp3-to-ogg'
                  ? 'ogg'
                  : outputFormat;
            const codecArgs =
              resolvedFormat === 'wav'
                ? ['-vn', '-c:a', 'pcm_s16le']
                : resolvedFormat === 'ogg'
                  ? ['-vn', '-c:a', 'libvorbis', '-q:a', '5']
                  : resolvedFormat === 'aac'
                    ? ['-vn', '-c:a', 'aac', '-b:a', '192k']
                    : ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'];
            ffmpegArgs = [
              '-y',
              '-i',
              inputPath,
              ...buildTimeArgs(),
              ...codecArgs,
              outputPath,
            ];
            break;
          }
          case 'video-to-gif':
          case 'mp4-to-gif':
          case 'webm-to-gif':
          case 'mov-to-gif':
          case 'avi-to-gif':
            ffmpegArgs = [
              '-y',
              '-i',
              inputPath,
              ...buildTimeArgs(),
              '-vf',
              `fps=${fps},scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos`,
              '-loop',
              '0',
              outputPath,
            ];
            break;
          case 'gif-to-mp4':
            ffmpegArgs = [
              '-y',
              '-i',
              inputPath,
              ...buildVideoOutputArgs('mp4'),
              outputPath,
            ];
            break;
          case 'gif-to-apng':
            ffmpegArgs = ['-y', '-i', inputPath, '-plays', '0', outputPath];
            break;
          case 'apng-to-gif':
            ffmpegArgs = [
              '-y',
              '-i',
              inputPath,
              '-vf',
              `fps=${fps},scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos`,
              '-loop',
              '0',
              outputPath,
            ];
            break;
          default:
            throw new Error('Unsupported media conversion preset.');
        }
      }

      await withTimeout(
        runProcess(FFMPEG_BIN, ffmpegArgs),
        120000,
        `ffmpeg ${preset}`
      );

      if (
        !(await waitForFile(outputPath, 15000)) ||
        !(await waitForReadableFile(outputPath, 15000))
      ) {
        throw new Error('Converted media file was not created.');
      }

      res.setHeader('Content-Type', getMediaMimeType(outputExt));
      res.setHeader(
        'Content-Disposition',
        contentDisposition(path.basename(outputPath))
      );

      res.download(outputPath, path.basename(outputPath), () => {
        cleanupJob();
      });
    } catch (error: any) {
      console.error('Media transcode failed:', error?.message || error);
      cleanupJob();
      res.status(500).json({
        error:
          error?.message ||
          'Media conversion failed. Please try another file or shorter clip.',
      });
    }
  }
);

const OFFICE_WORD_TO_PDF_SCRIPT = `
param([string]$InputPath, [string]$OutputPath)
function Invoke-WithRetry {
  param(
    [scriptblock]$Action,
    [int]$Retries = 8,
    [int]$DelayMs = 600
  )

  for ($attempt = 1; $attempt -le $Retries; $attempt++) {
    try {
      return & $Action
    } catch {
      if ($attempt -eq $Retries) {
        throw
      }
      Start-Sleep -Milliseconds $DelayMs
    }
  }
}

$word = $null
$doc = $null
try {
  $word = Invoke-WithRetry { New-Object -ComObject Word.Application }
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $doc = Invoke-WithRetry { $word.Documents.Open($InputPath, $false, $true) }
  Invoke-WithRetry { $doc.ExportAsFixedFormat($OutputPath, 17) } | Out-Null
  Start-Sleep -Milliseconds 750
} finally {
  if ($doc -ne $null) { $doc.Close([ref]$false) | Out-Null }
  if ($word -ne $null) { $word.Quit() }
  if ($doc -ne $null) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null }
  if ($word -ne $null) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
`;

const OFFICE_PPT_TO_PDF_SCRIPT = `
param([string]$InputPath, [string]$OutputPath)
function Invoke-WithRetry {
  param(
    [scriptblock]$Action,
    [int]$Retries = 8,
    [int]$DelayMs = 750
  )

  for ($attempt = 1; $attempt -le $Retries; $attempt++) {
    try {
      return & $Action
    } catch {
      if ($attempt -eq $Retries) {
        throw
      }
      Start-Sleep -Milliseconds $DelayMs
    }
  }
}

$app = $null
$presentation = $null
try {
  $app = Invoke-WithRetry { New-Object -ComObject PowerPoint.Application }
  $presentation = Invoke-WithRetry { $app.Presentations.Open($InputPath, $true, $false, $false) }
  Invoke-WithRetry { $presentation.SaveAs($OutputPath, 32) } | Out-Null
  Start-Sleep -Milliseconds 750
} finally {
  if ($presentation -ne $null) { $presentation.Close() }
  if ($app -ne $null) { $app.Quit() }
  if ($presentation -ne $null) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) | Out-Null }
  if ($app -ne $null) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
`;

const OFFICE_EXCEL_TO_PDF_SCRIPT = `
param([string]$InputPath, [string]$OutputPath)
function Invoke-WithRetry {
  param(
    [scriptblock]$Action,
    [int]$Retries = 8,
    [int]$DelayMs = 750
  )

  for ($attempt = 1; $attempt -le $Retries; $attempt++) {
    try {
      return & $Action
    } catch {
      if ($attempt -eq $Retries) {
        throw
      }
      Start-Sleep -Milliseconds $DelayMs
    }
  }
}

$excel = $null
$workbook = $null
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.ScreenUpdating = $false
  $workbook = Invoke-WithRetry { $excel.Workbooks.Open($InputPath) }
  foreach ($sheet in $workbook.Worksheets) {
    $sheet.PageSetup.Zoom = $false
    $sheet.PageSetup.FitToPagesWide = 1
    $sheet.PageSetup.FitToPagesTall = 1
  }
  Invoke-WithRetry { $workbook.ExportAsFixedFormat(0, $OutputPath) } | Out-Null
  Start-Sleep -Milliseconds 750
} finally {
  if ($workbook -ne $null) { $workbook.Close($false) }
  if ($excel -ne $null) { $excel.Quit() }
  if ($workbook -ne $null) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null }
  if ($excel -ne $null) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
`;

const OFFICE_HTML_TO_PDF_SCRIPT = OFFICE_WORD_TO_PDF_SCRIPT;

const PDF_PASSWORD_SCRIPT = `
import sys
from pypdf import PdfReader, PdfWriter

mode, input_path, output_path, password = sys.argv[1:5]
reader = PdfReader(input_path)

if mode == "unlock":
    if not reader.is_encrypted:
        raise SystemExit("PDF is not password protected")
    result = reader.decrypt(password)
    if result == 0:
        raise SystemExit("Incorrect password")

writer = PdfWriter()
for page in reader.pages:
    writer.add_page(page)

if mode == "protect":
    writer.encrypt(password)

with open(output_path, "wb") as handle:
    writer.write(handle)
`;

const YTDLP_INFO_SCRIPT = `
import json
import sys
from yt_dlp import YoutubeDL

url, output_path = sys.argv[1:3]
opts = {
    "quiet": True,
    "no_warnings": True,
    "skip_download": True,
    "noplaylist": True,
}

def extract_with_opts(base_opts):
    with YoutubeDL(base_opts) as ydl:
        return ydl.extract_info(url, download=False)

try:
    info = extract_with_opts(opts)
except Exception as original_error:
    fallback_opts = dict(opts)
    fallback_opts["cookiesfrombrowser"] = ("chrome",)
    try:
        info = extract_with_opts(fallback_opts)
    except Exception:
        raise original_error

payload = {
    "title": info.get("title"),
    "thumbnail": info.get("thumbnail") or ((info.get("thumbnails") or [{}])[-1].get("url")),
    "author": info.get("uploader") or info.get("channel") or info.get("creator"),
    "duration": info.get("duration"),
    "webpage_url": info.get("webpage_url") or url,
    "formats": []
}

for fmt in info.get("formats") or []:
    payload["formats"].append({
        "format_id": fmt.get("format_id"),
        "ext": fmt.get("ext"),
        "height": fmt.get("height"),
        "width": fmt.get("width"),
        "vcodec": fmt.get("vcodec"),
        "acodec": fmt.get("acodec"),
        "abr": fmt.get("abr"),
        "tbr": fmt.get("tbr"),
        "filesize": fmt.get("filesize") or fmt.get("filesize_approx"),
        "format_note": fmt.get("format_note"),
    })

with open(output_path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle)
`;

const YTDLP_DOWNLOAD_SCRIPT = `
import glob
import json
import os
import sys
from yt_dlp import YoutubeDL

mode, url, quality, base_path, output_path = sys.argv[1:6]
outtmpl = base_path + ".%(ext)s"

def build_video_candidates(selected_quality):
    candidates = []
    if selected_quality and selected_quality.isdigit():
        q = selected_quality
        candidates.extend([
            f"bestvideo[height<={q}]+bestaudio/best[height<={q}]",
            f"bv*[height<={q}]+ba/b[height<={q}]",
            f"best[height<={q}]/best",
        ])
    candidates.extend([
        "bestvideo+bestaudio/best",
        "bv*+ba/b",
        "best",
    ])
    seen = []
    for item in candidates:
        if item not in seen:
            seen.append(item)
    return seen

if mode == "audio":
    format_candidates = [
        "bestaudio[ext=m4a]/bestaudio/best",
        "bestaudio/best",
    ]
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "outtmpl": outtmpl,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
    }
else:
    format_candidates = build_video_candidates(quality)
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "merge_output_format": "mp4",
        "outtmpl": outtmpl,
    }

def download_with_opts(base_opts, selected_format):
    opts = dict(base_opts)
    opts["format"] = selected_format
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return info.get("title") or "media"

last_error = None
title = "media"

for selected_format in format_candidates:
    try:
        title = download_with_opts(ydl_opts, selected_format)
        last_error = None
        break
    except Exception as original_error:
        last_error = original_error
        fallback_opts = dict(ydl_opts)
        fallback_opts["cookiesfrombrowser"] = ("chrome",)
        try:
            title = download_with_opts(fallback_opts, selected_format)
            last_error = None
            break
        except Exception as cookie_error:
            last_error = cookie_error or original_error

if last_error:
    raise last_error

matches = [p for p in glob.glob(base_path + ".*") if not p.endswith(".part")]
matches.sort(key=lambda p: os.path.getmtime(p), reverse=True)
if not matches:
    raise SystemExit("No downloaded file found")

final_path = matches[0]
payload = {
    "path": final_path,
    "title": title,
    "ext": os.path.splitext(final_path)[1].lstrip("."),
}

with open(output_path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle)
`;

app.post('/api/office/word-to-pdf', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'DOCX file is required' });

  const sourcePath = prepareUploadedSourcePath(file, '.docx');
  const outputPath = path.resolve(
    path.join('uploads', `word_${Date.now()}.pdf`)
  );
  try {
    const resolvedSourcePath = sourcePath || path.resolve(file.path);
    if (IS_WINDOWS) {
      await runPowerShellScript(OFFICE_WORD_TO_PDF_SCRIPT, [
        resolvedSourcePath,
        outputPath,
      ]);
    } else {
      await runLibreOfficeConvertToPdf(resolvedSourcePath, outputPath);
    }
    if (
      !(await waitForFile(outputPath, 12000)) ||
      !(await waitForReadableFile(outputPath, 12000))
    ) {
      throw new Error('PDF was not created');
    }
    sendDownloadedFile(res, outputPath, 'document.pdf', [
      file.path,
      sourcePath || undefined,
    ]);
  } catch (error: any) {
    console.error('Word to PDF failed:', error.message);
    cleanupPaths(file.path, sourcePath || undefined, outputPath);
    res
      .status(500)
      .json({
        error:
          'Failed to convert Word to PDF. Check Office or LibreOffice support on the server.',
      });
  }
});

app.post('/api/office/ppt-to-pdf', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'PPTX file is required' });

  const sourcePath = prepareUploadedSourcePath(file, '.pptx');
  const outputPath = path.resolve(
    path.join('uploads', `slides_${Date.now()}.pdf`)
  );
  try {
    const resolvedSourcePath = sourcePath || path.resolve(file.path);
    if (IS_WINDOWS) {
      await runPowerShellScript(OFFICE_PPT_TO_PDF_SCRIPT, [
        resolvedSourcePath,
        outputPath,
      ]);
    } else {
      await runLibreOfficeConvertToPdf(resolvedSourcePath, outputPath);
    }
    if (
      !(await waitForFile(outputPath, 12000)) ||
      !(await waitForReadableFile(outputPath, 12000))
    ) {
      throw new Error('PDF was not created');
    }
    sendDownloadedFile(res, outputPath, 'slides.pdf', [
      file.path,
      sourcePath || undefined,
    ]);
  } catch (error: any) {
    console.error('PPT to PDF failed:', error.message);
    cleanupPaths(file.path, sourcePath || undefined, outputPath);
    res
      .status(500)
      .json({
        error:
          'Failed to convert PowerPoint to PDF. Check Office or LibreOffice support on the server.',
      });
  }
});

app.post(
  '/api/office/excel-to-pdf',
  upload.single('file'),
  async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Excel file is required' });

    const sourcePath = prepareUploadedSourcePath(file, '.xlsx');
    const outputPath = path.resolve(
      path.join('uploads', `sheet_${Date.now()}.pdf`)
    );
    try {
      await runPythonFile(path.resolve('scripts', 'xlsx_to_pdf.py'), [
        sourcePath || path.resolve(file.path),
        outputPath,
      ]);
      if (
        !(await waitForFile(outputPath, 12000)) ||
        !(await waitForReadableFile(outputPath, 12000))
      ) {
        throw new Error('PDF was not created');
      }
      sendDownloadedFile(res, outputPath, 'sheet.pdf', [
        file.path,
        sourcePath || undefined,
      ]);
    } catch (error: any) {
      console.error('Excel to PDF failed:', error.message);
      cleanupPaths(file.path, sourcePath || undefined, outputPath);
      res.status(500).json({ error: 'Failed to convert Excel to PDF.' });
    }
  }
);

app.post(
  '/api/office/html-to-pdf',
  upload.fields([{ name: 'file', maxCount: 1 }]),
  async (req, res) => {
    const files = req.files as { file?: Express.Multer.File[] } | undefined;
    const htmlFile = files?.file?.[0];
    const htmlBody = String(req.body.html || '').trim();
    let tempHtmlPath: string | null = null;
    let preparedHtmlPath: string | null = null;
    const outputPath = path.resolve(
      path.join('uploads', `html_${Date.now()}.pdf`)
    );

    try {
      let sourcePath = htmlFile?.path;
      if (!sourcePath) {
        if (!htmlBody) {
          return res
            .status(400)
            .json({ error: 'HTML file or HTML content is required' });
        }
        tempHtmlPath = path.join('uploads', `html_${Date.now()}.html`);
        fs.writeFileSync(tempHtmlPath, htmlBody, 'utf8');
        sourcePath = tempHtmlPath;
      } else {
        preparedHtmlPath = prepareUploadedSourcePath(htmlFile, '.html');
        sourcePath = preparedHtmlPath || sourcePath;
      }

      const resolvedSourcePath = path.resolve(sourcePath);
      if (IS_WINDOWS) {
        await runPowerShellScript(OFFICE_HTML_TO_PDF_SCRIPT, [
          resolvedSourcePath,
          outputPath,
        ]);
      } else {
        await runLibreOfficeConvertToPdf(resolvedSourcePath, outputPath);
      }
      if (
        !(await waitForFile(outputPath, 12000)) ||
        !(await waitForReadableFile(outputPath, 12000))
      ) {
        throw new Error('PDF was not created');
      }
      sendDownloadedFile(res, outputPath, 'page.pdf', [
        htmlFile?.path,
        tempHtmlPath || undefined,
        preparedHtmlPath || undefined,
      ]);
    } catch (error: any) {
      console.error('HTML to PDF failed:', error.message);
      cleanupPaths(
        htmlFile?.path,
        tempHtmlPath || undefined,
        preparedHtmlPath || undefined,
        outputPath
      );
      res
        .status(500)
        .json({
          error:
            'Failed to convert HTML to PDF. Check Office or LibreOffice support on the server.',
        });
    }
  }
);

app.post('/api/office/pdf-to-word', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'PDF file is required' });

  const startedAt = Date.now();
  const outputPath = path.resolve(
    path.join('uploads', `document_${Date.now()}.docx`)
  );
  try {
    await runPythonFile(path.resolve('scripts', 'pdf_to_docx_editable.py'), [
      path.resolve(file.path),
      outputPath,
    ]);
    let finalOutputPath = outputPath;
    if (!(await waitForFile(outputPath))) {
      const fallback = fs
        .readdirSync(uploadsDir)
        .filter((name) => name.endsWith('.docx'))
        .map((name) => {
          const fullPath = path.join(uploadsDir, name);
          return {
            fullPath,
            mtimeMs: fs.statSync(fullPath).mtimeMs,
          };
        })
        .filter((entry) => entry.mtimeMs >= startedAt - 2000)
        .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];

      if (!fallback) {
        throw new Error('DOCX was not created');
      }
      finalOutputPath = fallback.fullPath;
    }
    sendDownloadedFile(res, finalOutputPath, 'document.docx', [
      file.path,
      finalOutputPath !== outputPath ? outputPath : undefined,
    ]);
  } catch (error: any) {
    console.error('PDF to Word failed:', error.message);
    cleanupPaths(file.path, outputPath);
    res.status(500).json({ error: 'Failed to convert PDF to Word.' });
  }
});

app.post('/api/pdf/merge', upload.array('files'), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length < 2) {
      return res
        .status(400)
        .json({ error: 'At least 2 PDF files are required' });
    }

    const mergedPdf = await PDFDocument.create();
    for (const file of files) {
      const pdfBytes = fs.readFileSync(file.path);
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    const outputPath = path.join('uploads', `merged_${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, mergedPdfBytes);

    // Cleanup input files
    files.forEach((f) => fs.unlinkSync(f.path));

    res.download(outputPath, 'merged.pdf', () => {
      fs.unlinkSync(outputPath); // Cleanup output after download
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to merge PDFs' });
  }
});

app.post('/api/pdf/split', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'PDF file is required' });

    const pdfBytes = fs.readFileSync(file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const pageCount = pdf.getPageCount();

    // For simplicity, we'll just return the first page as a split example or handle ranges
    // Real implementation would likely return a zip of all pages or specific ranges
    const newPdf = await PDFDocument.create();
    const [firstPage] = await newPdf.copyPages(pdf, [0]);
    newPdf.addPage(firstPage);

    const newPdfBytes = await newPdf.save();
    const outputPath = path.join('uploads', `split_${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, newPdfBytes);

    fs.unlinkSync(file.path);
    res.download(outputPath, 'split_page_1.pdf', () =>
      fs.unlinkSync(outputPath)
    );
  } catch (error) {
    res.status(500).json({ error: 'Failed to split PDF' });
  }
});

app.post('/api/pdf/rotate', upload.single('file'), async (req, res) => {
  try {
    const { rotation = 90 } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'PDF file is required' });

    const pdfBytes = fs.readFileSync(file.path);
    const pdf = await PDFDocument.load(pdfBytes);
    const pages = pdf.getPages();
    pages.forEach((page) => {
      page.setRotation(degrees(Number(rotation)));
    });

    const rotatedPdfBytes = await pdf.save();
    const outputPath = path.join('uploads', `rotated_${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, rotatedPdfBytes);

    fs.unlinkSync(file.path);
    res.download(outputPath, 'rotated.pdf', () => fs.unlinkSync(outputPath));
  } catch (error) {
    res.status(500).json({ error: 'Failed to rotate PDF' });
  }
});

app.post('/api/pdf/translate', async (req, res) => {
  const { text, targetLang } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' });
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.startsWith('YOUR_')) {
    return res.status(400).json({ error: 'GEMINI_API_KEY is missing' });
  }

  const language = (targetLang || 'en').toString();
  const ai = new GoogleGenAI({ apiKey });
  const chunkSize = 6000;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  try {
    const translatedChunks: string[] = [];
    for (const chunk of chunks) {
      const prompt = `Translate the following text into ${language}. Preserve meaning and keep formatting readable:\n\n${chunk}`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      translatedChunks.push(response.text || '');
    }

    res.json({ translatedText: translatedChunks.join('\n') });
  } catch (error: any) {
    console.error('Translate PDF failed:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

app.post('/api/pdf/protect', upload.single('file'), async (req, res) => {
  const file = req.file;
  const password = String(req.body.password || '').trim();
  if (!file) return res.status(400).json({ error: 'PDF file is required' });
  if (!password) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Password is required' });
  }

  const outputName = `protected_${Date.now()}.pdf`;
  const outputPath = path.join('uploads', outputName);
  try {
    await runPythonScript(PDF_PASSWORD_SCRIPT, [
      'protect',
      path.resolve(file.path),
      path.resolve(outputPath),
      password,
    ]);
    sendDownloadedFile(res, outputPath, 'protected.pdf', [file.path]);
  } catch (error: any) {
    console.error('Protect PDF failed:', error.message);
    cleanupPaths(file?.path, outputPath);
    res.status(500).json({ error: 'Failed to protect PDF.' });
  }
});

app.post('/api/pdf/unlock', upload.single('file'), async (req, res) => {
  const file = req.file;
  const password = String(req.body.password || '').trim();
  if (!file) return res.status(400).json({ error: 'PDF file is required' });
  if (!password) {
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Password is required' });
  }

  const outputName = `unlocked_${Date.now()}.pdf`;
  const outputPath = path.join('uploads', outputName);
  try {
    await runPythonScript(PDF_PASSWORD_SCRIPT, [
      'unlock',
      path.resolve(file.path),
      path.resolve(outputPath),
      password,
    ]);
    sendDownloadedFile(res, outputPath, 'unlocked.pdf', [file.path]);
  } catch (error: any) {
    console.error('Unlock PDF failed:', error.message);
    cleanupPaths(file?.path, outputPath);
    res.status(500).json({ error: 'Failed to unlock PDF.' });
  }
});

// --- IMAGE TOOLS API ---

app.post('/api/image/remove-bg', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Image is required' });

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (
      !apiKey ||
      apiKey === 'MY_GEMINI_API_KEY' ||
      apiKey.startsWith('YOUR_')
    ) {
      const fallback = await removeNearWhiteBackground(file.path);
      res.setHeader('Content-Type', 'image/png');
      return res.send(fallback);
    }

    const ai = new GoogleGenAI({ apiKey });
    const imageBytes = fs.readFileSync(file.path).toString('base64');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: imageBytes, mimeType: file.mimetype } },
          {
            text: 'Remove the background from this image and return only the subject with a transparent background. Output as a PNG image.',
          },
        ],
      },
    });

    let base64Data = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        base64Data = part.inlineData.data;
        break;
      }
    }

    if (!base64Data) {
      const fallback = await removeNearWhiteBackground(file.path);
      res.setHeader('Content-Type', 'image/png');
      return res.send(fallback);
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const outputPath = path.join('uploads', `no_bg_${Date.now()}.png`);
    fs.writeFileSync(outputPath, buffer);

    res.download(outputPath, 'removed_bg.png', () => fs.unlinkSync(outputPath));
  } catch (error) {
    console.error('Background removal failed:', error);
    const file = req.file;
    if (file?.path && fs.existsSync(file.path)) {
      try {
        const fallback = await removeNearWhiteBackground(file.path);
        res.setHeader('Content-Type', 'image/png');
        return res.send(fallback);
      } catch (fallbackError) {
        console.error('Background removal fallback failed:', fallbackError);
      }
    }
    const message =
      error instanceof Error ? error.message : 'Background removal failed';
    res.status(500).json({ error: message });
  } finally {
    const file = req.file;
    if (file?.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        // ignore cleanup errors
      }
    }
  }
});

// --- MEDIAFLOW API ---

// History Endpoints
app.get('/api/history', async (_req, res) => {
  try {
    const history = await dbQuery(
      'SELECT * FROM history ORDER BY timestamp DESC LIMIT 10'
    );
    res.json(history);
  } catch {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.post('/api/history', async (req, res) => {
  const { title, thumbnail, url, tool } = req.body;
  try {
    await dbQuery(
      'INSERT INTO history (title, thumbnail, url, tool) VALUES (?, ?, ?, ?)',
      [title, thumbnail, url, tool]
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to save history' });
  }
});

app.delete('/api/history', async (_req, res) => {
  try {
    await dbQuery('DELETE FROM history');
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

// Tool usage tracking
app.post('/api/usage', async (req, res) => {
  const { toolId, subAction, clientId } = req.body || {};
  if (!toolId) return res.status(400).json({ error: 'toolId is required' });

  try {
    await dbQuery(
      'INSERT INTO tool_usage (tool_id, sub_action, client_id, user_agent, ip) VALUES (?, ?, ?, ?, ?)',
      [
        toolId,
        subAction || null,
        clientId || null,
        req.headers['user-agent'] || null,
        req.headers['x-forwarded-for'] || req.ip || null,
      ]
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to record usage' });
  }
});

// Contact messages — 5 submissions per IP per minute
app.post('/api/contact', rateLimit(5, 60_000), async (req, res) => {
  const { name, email, phone, subject, message, category } = req.body || {};
  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ error: 'Name, email, and message are required' });
  }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_RE.test(String(email))) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    await dbQuery(
      'INSERT INTO contact_messages (name, email, phone, subject, message, category, reply_status, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        name,
        email,
        phone || '',
        subject || '',
        message,
        category || 'general',
        'pending',
        req.headers['x-forwarded-for'] || req.ip || null,
      ]
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to save contact message' });
  }
});

app.post(
  '/api/admin/messages/:messageId/reply',
  requireAdmin,
  async (req, res) => {
    const messageId = Number(req.params.messageId);
    const replyText = String(req.body?.replyText || '').trim();

    if (!Number.isFinite(messageId) || messageId <= 0) {
      return res.status(400).json({ error: 'Invalid message id.' });
    }

    if (!replyText) {
      return res.status(400).json({ error: 'Reply text is required.' });
    }

    try {
      const rows = await dbQuery<
        Array<{
          id: number;
          name: string;
          email: string;
          phone?: string | null;
          subject?: string | null;
        }>
      >(
        'SELECT id, name, email, phone, subject FROM contact_messages WHERE id = ? LIMIT 1',
        [messageId]
      );

      const message = Array.isArray(rows) ? rows[0] : null;
      if (!message) {
        return res.status(404).json({ error: 'Message not found.' });
      }

      const normalizedPhone = normalizeWhatsappPhone(
        String(message.phone || '')
      );
      const channel = normalizedPhone ? 'whatsapp' : 'email';
      const subject = String(message.subject || 'VinzaTools Support');
      const safeName = String(message.name || 'there');
      const replyBody = `Assalam o Alaikum ${safeName},\n\n${replyText}`;
      const targetUrl =
        channel === 'whatsapp'
          ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(replyBody)}`
          : `mailto:${encodeURIComponent(String(message.email || ''))}?subject=${encodeURIComponent(`Re: ${subject}`)}&body=${encodeURIComponent(replyBody)}`;

      const repliedAtValue =
        databaseMode === 'mysql' ? new Date() : new Date().toISOString();

      await dbQuery(
        'UPDATE contact_messages SET reply_status = ?, last_reply_channel = ?, last_reply_text = ?, replied_at = ? WHERE id = ?',
        ['replied', channel, replyText, repliedAtValue, messageId]
      );

      res.json({
        success: true,
        channel,
        targetUrl,
        message: `Reply prepared for ${channel}.`,
      });
    } catch (error) {
      console.error('Failed to prepare reply:', error);
      res.status(500).json({ error: 'Failed to prepare reply.' });
    }
  }
);

app.post(
  '/api/admin/messages/:messageId/read',
  requireAdmin,
  async (req, res) => {
    const messageId = Number(req.params.messageId);

    if (!Number.isFinite(messageId) || messageId <= 0) {
      return res.status(400).json({ error: 'Invalid message id.' });
    }

    try {
      const rows = await dbQuery<
        Array<{ id: number; replyStatus?: string | null }>
      >(
        'SELECT id, reply_status as replyStatus FROM contact_messages WHERE id = ? LIMIT 1',
        [messageId]
      );

      const message = Array.isArray(rows) ? rows[0] : null;
      if (!message) {
        return res.status(404).json({ error: 'Message not found.' });
      }

      const nextStatus = message.replyStatus === 'replied' ? 'replied' : 'read';
      await dbQuery(
        'UPDATE contact_messages SET reply_status = ? WHERE id = ?',
        [nextStatus, messageId]
      );

      res.json({
        success: true,
        status: nextStatus,
        message:
          nextStatus === 'replied'
            ? 'Message is already replied.'
            : 'Message marked as read.',
      });
    } catch (error) {
      console.error('Failed to mark message as read:', error);
      res.status(500).json({ error: 'Failed to mark message as read.' });
    }
  }
);

app.delete('/api/admin/messages/:messageId', requireAdmin, async (req, res) => {
  const messageId = Number(req.params.messageId);

  if (!Number.isFinite(messageId) || messageId <= 0) {
    return res.status(400).json({ error: 'Invalid message id.' });
  }

  try {
    const rows = await dbQuery<Array<{ id: number }>>(
      'SELECT id FROM contact_messages WHERE id = ? LIMIT 1',
      [messageId]
    );

    const message = Array.isArray(rows) ? rows[0] : null;
    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    await dbQuery('DELETE FROM contact_messages WHERE id = ?', [messageId]);
    res.json({ success: true, message: 'Message deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete message:', error);
    res.status(500).json({ error: 'Failed to delete message.' });
  }
});

// Admin overview
app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
  try {
    const themes = scanShopifyThemes();
    await syncThemeLibraryToDb(themes);
    const activeThemeIds = themes.map((theme) => theme.id);
    const themeWhereClause = activeThemeIds.length
      ? ` WHERE theme_id IN (${activeThemeIds.map(() => '?').join(', ')})`
      : '';
    const themeWhereParams = activeThemeIds;

    const usageByTool = await dbQuery(
      'SELECT tool_id as toolId, COUNT(*) as count FROM tool_usage GROUP BY tool_id ORDER BY count DESC'
    );
    const usageByUser = await dbQuery(
      'SELECT client_id as clientId, COUNT(*) as count FROM tool_usage GROUP BY client_id ORDER BY count DESC LIMIT 20'
    );
    const usageByUserTool = await dbQuery(
      'SELECT client_id as clientId, tool_id as toolId, COUNT(*) as count FROM tool_usage GROUP BY client_id, tool_id ORDER BY count DESC LIMIT 50'
    );
    const usageByDay = await dbQuery(
      databaseMode === 'mysql'
        ? 'SELECT DATE(timestamp) as day, COUNT(*) as count FROM tool_usage GROUP BY day ORDER BY day DESC LIMIT 14'
        : 'SELECT date(timestamp) as day, COUNT(*) as count FROM tool_usage GROUP BY day ORDER BY day DESC LIMIT 14'
    );
    const usageByIp = await dbQuery(
      "SELECT ip, COUNT(*) as count FROM tool_usage WHERE ip IS NOT NULL AND ip <> '' GROUP BY ip ORDER BY count DESC LIMIT 20"
    );
    const recentUsage = await dbQuery(
      'SELECT tool_id as toolId, sub_action as subAction, client_id as clientId, ip, timestamp FROM tool_usage ORDER BY timestamp DESC LIMIT 15'
    );
    const messages = await dbQuery(
      'SELECT id, name, email, phone, subject, message, category, reply_status as replyStatus, last_reply_channel as lastReplyChannel, last_reply_text as lastReplyText, replied_at as repliedAt, ip, timestamp FROM contact_messages ORDER BY timestamp DESC LIMIT 50'
    );
    const recentThemeActivity = activeThemeIds.length
      ? await dbQuery(
          `SELECT theme_id as themeId, action_name as actionName, ip, user_agent as userAgent, timestamp
           FROM theme_activity${themeWhereClause}
           ORDER BY timestamp DESC LIMIT 20`,
          themeWhereParams
        )
      : [];
    const themeActivityByTheme = activeThemeIds.length
      ? await dbQuery(
          `SELECT theme_id as themeId, COUNT(*) as count
           FROM theme_activity${themeWhereClause}
           GROUP BY theme_id ORDER BY count DESC LIMIT 20`,
          themeWhereParams
        )
      : [];
    const themeTrafficByVisitor = activeThemeIds.length
      ? await dbQuery(
          `SELECT
        COALESCE(NULLIF(ip, ''), 'Unknown') as ip,
        COUNT(*) as totalActions,
        SUM(CASE WHEN action_name = 'download' THEN 1 ELSE 0 END) as downloads,
        SUM(CASE WHEN action_name IN ('preview_view', 'open_preview') THEN 1 ELSE 0 END) as previews,
        SUM(CASE WHEN action_name = 'prepare_preview' THEN 1 ELSE 0 END) as prepares,
        MAX(timestamp) as lastSeen
      FROM theme_activity${themeWhereClause}
      GROUP BY COALESCE(NULLIF(ip, ''), 'Unknown')
      ORDER BY totalActions DESC, lastSeen DESC
      LIMIT 20`,
          themeWhereParams
        )
      : [];
    const themeTrafficByDay = activeThemeIds.length
      ? await dbQuery(
          databaseMode === 'mysql'
            ? `SELECT DATE(timestamp) as day, COUNT(*) as count
           FROM theme_activity${themeWhereClause}
           GROUP BY day
           ORDER BY day DESC
           LIMIT 14`
            : `SELECT date(timestamp) as day, COUNT(*) as count
           FROM theme_activity${themeWhereClause}
           GROUP BY day
           ORDER BY day DESC
           LIMIT 14`,
          themeWhereParams
        )
      : [];
    const themeActionCountsRows = activeThemeIds.length
      ? await dbQuery<Array<{ actionName: string; count: number }>>(
          `SELECT action_name as actionName, COUNT(*) as count
           FROM theme_activity${themeWhereClause}
           GROUP BY action_name ORDER BY count DESC`,
          themeWhereParams
        )
      : [];
    const themeLibraryRows = await dbQuery<
      Array<{
        themeId: string;
        themeName: string;
        relativePath: string;
        fileCount: number;
        previewFilesCount: number;
        hasPreview: number;
        canBuildPreview: number;
        lastSynced: string;
      }>
    >(
      `SELECT
        theme_id as themeId,
        theme_name as themeName,
        relative_path as relativePath,
        file_count as fileCount,
        preview_files_count as previewFilesCount,
        has_preview as hasPreview,
        can_build_preview as canBuildPreview,
        last_synced as lastSynced
      FROM theme_library
      ORDER BY theme_name ASC`
    );
    const actionCounts = themeActionCountsRows.reduce<Record<string, number>>(
      (acc, row) => {
        acc[row.actionName] = Number(row.count || 0);
        return acc;
      },
      {}
    );
    const themeSource = themeLibraryRows.length
      ? themeLibraryRows.map((row) => ({
          fileCount: Number(row.fileCount || 0),
          previewFilesCount: Number(row.previewFilesCount || 0),
          hasPreview: Boolean(row.hasPreview),
          canBuildPreview: Boolean(row.canBuildPreview),
        }))
      : themes.map((theme) => ({
          fileCount: Number(theme.fileCount || 0),
          previewFilesCount: Number(theme.previewFiles?.length || 0),
          hasPreview: Boolean(theme.hasPreview),
          canBuildPreview: Boolean(theme.canBuildPreview),
        }));
    const themeSummary = {
      totalThemes: themeSource.length,
      previewReady: themeSource.filter((theme) => theme.hasPreview).length,
      buildReady: themeSource.filter((theme) => theme.canBuildPreview).length,
      totalFiles: themeSource.reduce((sum, theme) => sum + theme.fileCount, 0),
      totalQuickPreviewFiles: themeSource.reduce(
        (sum, theme) => sum + theme.previewFilesCount,
        0
      ),
      totalDownloads: actionCounts.download || 0,
      totalPreviews:
        (actionCounts.preview_view || 0) + (actionCounts.open_preview || 0),
      totalPrepares: actionCounts.prepare_preview || 0,
      uniqueVisitors: Array.isArray(themeTrafficByVisitor)
        ? themeTrafficByVisitor.length
        : 0,
      totalTraffic: Array.isArray(themeTrafficByVisitor)
        ? themeTrafficByVisitor.reduce(
            (sum: number, row: any) => sum + Number(row.totalActions || 0),
            0
          )
        : 0,
    };
    res.json({
      usageByTool,
      usageByUser,
      usageByUserTool,
      usageByDay,
      usageByIp,
      recentUsage,
      messages,
      themes,
      themeLibraryRows,
      themeSummary,
      recentThemeActivity,
      themeActivityByTheme,
      themeTrafficByVisitor,
      themeTrafficByDay,
      databaseMode,
      databaseName: databaseMode === 'mysql' ? MYSQL_DATABASE : sqliteDbPath,
    });
  } catch {
    res.status(500).json({ error: 'Failed to load admin overview' });
  }
});

app.get('/api/db-viewer/summary', requireAdmin, async (_req, res) => {
  try {
    if (databaseMode === 'sqlite' && sqliteDb) {
      const tables = sqliteDb
        .prepare(
          'SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE ? ORDER BY name ASC'
        )
        .all('table', 'sqlite_%')
        .map((row: any) => ({
          name: row.name,
          rowsCount: Number(
            sqliteDb!
              .prepare(`SELECT COUNT(*) as count FROM ${'`'}${row.name}${'`'}`)
              .get().count || 0
          ),
        }));

      return res.json({
        database: sqliteDbPath,
        host: 'local',
        port: 0,
        databaseMode,
        tables,
      });
    }

    const tables = await dbQuery(
      'SELECT TABLE_NAME as name, TABLE_ROWS as rowsCount FROM information_schema.tables WHERE table_schema = ? ORDER BY TABLE_NAME ASC',
      [MYSQL_DATABASE]
    );
    res.json({
      database: MYSQL_DATABASE,
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      databaseMode,
      tables,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load database tables.' });
  }
});

app.get('/api/db-viewer/table/:table', requireAdmin, async (req, res) => {
  const table = String(req.params.table || '').trim();
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));

  if (!/^[A-Za-z0-9_]+$/.test(table)) {
    return res.status(400).json({ error: 'Invalid table name.' });
  }

  try {
    if (databaseMode === 'sqlite' && sqliteDb) {
      const found = sqliteDb
        .prepare(
          'SELECT name FROM sqlite_master WHERE type = ? AND name = ? LIMIT 1'
        )
        .all('table', table) as Array<{ name: string }>;

      if (!found.length) {
        return res.status(404).json({ error: 'Table not found.' });
      }

      const rows = sqliteDb
        .prepare(`SELECT * FROM \`${table}\` LIMIT ?`)
        .all(limit) as any[];
      const columns = rows.length ? Object.keys(rows[0]) : [];

      return res.json({
        table,
        columns,
        rows,
        count: rows.length,
        limit,
        databaseMode,
      });
    }

    const found = await dbQuery<Array<{ name: string }>>(
      'SELECT TABLE_NAME as name FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1',
      [MYSQL_DATABASE, table]
    );

    if (!found.length) {
      return res.status(404).json({ error: 'Table not found.' });
    }

    const rows = await dbQuery<any[]>(
      `SELECT * FROM \`${table}\` LIMIT ?`,
      [limit]
    );
    const columns = rows.length ? Object.keys(rows[0]) : [];

    res.json({
      table,
      columns,
      rows,
      count: rows.length,
      limit,
      databaseMode,
    });
  } catch {
    res.status(500).json({ error: 'Failed to load table rows.' });
  }
});

// Gemini Summarization
app.post('/api/summarize', async (req, res) => {
  const { title, author, tool } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.startsWith('YOUR_')) {
    return res.status(400).json({ error: 'GEMINI_API_KEY is missing' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are a helpful assistant. I have a video titled "${title}" by "${author || 'Unknown'}" from ${tool}.
Based ONLY on the title and context, provide a very brief (2-3 sentences) summary of what this video is likely about.
If it's a music video, mention the artist. If it's a tutorial, mention the topic.
Keep it professional and concise.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    res.json({ summary: response.text });
  } catch (error: any) {
    console.error('Gemini Error:', error);
    res
      .status(500)
      .json({ error: 'Failed to generate summary: ' + error.message });
  }
});

const getCobaltInstances = () => {
  const raw = (
    process.env.COBALT_BASE_URLS ||
    process.env.COBALT_BASE_URL ||
    ''
  ).trim();
  const custom = raw
    ? raw
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean)
    : [];
  if (custom.length > 0) {
    return custom;
  }
  const defaults = [
    'http://localhost:9000',
    'https://api.cobalt.tools',
    'https://cobalt.api.unblocker.it',
    'https://cobalt.moe',
    'https://cobalt.ignis-draconis.com',
    'https://cobalt.smash-the-stack.com',
  ];
  return Array.from(new Set([...custom, ...defaults]));
};

type YtDlpFormat = {
  format_id?: string;
  ext?: string;
  height?: number | null;
  width?: number | null;
  vcodec?: string;
  acodec?: string;
  abr?: number | null;
  tbr?: number | null;
  filesize?: number | null;
  format_note?: string | null;
};

type YtDlpInfo = {
  title?: string;
  thumbnail?: string;
  author?: string;
  duration?: number | null;
  webpage_url?: string;
  formats?: YtDlpFormat[];
};

const sanitizeFilename = (value: string, fallback = 'media') => {
  const cleaned = value
    .replace(/[^\w\s-]/gi, '')
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
};

const normalizeExternalMediaUrl = (rawUrl: string, baseUrl?: string) => {
  const value = (rawUrl || '').trim();
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('//')) {
    return `https:${value}`;
  }

  if (baseUrl) {
    try {
      return new URL(value, baseUrl).toString();
    } catch {
      // Fall through to the generic https path below.
    }
  }

  return `https://${value.replace(/^\/+/, '')}`;
};

const buildProxyDownloadPath = (
  rawUrl: string,
  title: string,
  ext = 'mp4',
  baseUrl?: string
) => {
  const normalized = normalizeExternalMediaUrl(rawUrl, baseUrl);
  return `/api/proxy-download?${new URLSearchParams({
    url: normalized,
    title,
    ext,
  }).toString()}`;
};

type SaveInstaConfig = {
  url: string;
  token: string;
  exp: string;
  lang: string;
};

let saveInstaCache: { value: SaveInstaConfig; fetchedAt: number } | null = null;

const getSaveInstaConfig = async (): Promise<SaveInstaConfig> => {
  if (
    saveInstaCache &&
    Date.now() - saveInstaCache.fetchedAt < 10 * 60 * 1000
  ) {
    return saveInstaCache.value;
  }

  const response = await axios.get('https://saveinsta.io/', {
    timeout: 30000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  });

  const html = String(response.data || '');
  const readValue = (key: string) => {
    const match = html.match(new RegExp(`${key}\\s*=\\s*["']?([^;"']+)`));
    return match?.[1]?.trim() || '';
  };

  const value = {
    url: readValue('k_url_search'),
    token: readValue('k_token'),
    exp: readValue('k_exp'),
    lang: readValue('k_lang') || 'en',
  };

  if (!value.url || !value.token || !value.exp) {
    throw new Error('SaveInsta config not available');
  }

  saveInstaCache = { value, fetchedAt: Date.now() };
  return value;
};

const decodeSaveInstaScript = (script: string) => {
  let decoded = '';
  const sandbox: Record<string, any> = {
    console,
    decodeURIComponent,
    encodeURIComponent,
    String,
    Number,
    Math,
    Date,
    Array,
    Object,
    RegExp,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    window: {},
    document: {},
    eval: (code: string) => {
      decoded = code;
      return code;
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { timeout: 5000 });
  return decoded;
};

const parseSaveInstaHtml = (decodedScript: string) => {
  const htmlMatch = decodedScript.match(/innerHTML\s*=\s*"([\s\S]*?)";/);
  if (!htmlMatch) {
    return {
      html: '',
      thumbnail: '',
      isVideo: false,
      options: [] as Array<{ url: string; label: string }>,
    };
  }

  const html = htmlMatch[1]
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\\//g, '/');
  const thumbnail = html.match(/<img[^>]+src="([^"]+)"/)?.[1] || '';
  const isVideo = html.includes('icon-dlvideo');
  const options = Array.from(
    html.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)
  ).map((match) => ({
    url: match[1],
    label: match[2],
  }));

  return { html, thumbnail, isVideo, options };
};

const fetchInstagramViaSaveInsta = async (url: string) => {
  const config = await getSaveInstaConfig();
  const response = await axios.post(
    config.url,
    new URLSearchParams({
      k_exp: config.exp,
      k_token: config.token,
      q: url,
      t: 'media',
      lang: config.lang || 'en',
      v: 'v2',
      html: '',
    }).toString(),
    {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Referer: 'https://saveinsta.io/',
      },
    }
  );

  const payload = response.data || {};
  if (
    payload.mess &&
    typeof payload.mess === 'string' &&
    /private/i.test(payload.mess)
  ) {
    throw new Error('Instagram media is private or requires login.');
  }

  if (!payload.data || typeof payload.data !== 'string') {
    throw new Error(payload.mess || 'Instagram fallback data unavailable');
  }

  const decoded = decodeSaveInstaScript(payload.data);
  const parsed = parseSaveInstaHtml(decoded);
  if (!parsed.options.length) {
    throw new Error('Instagram fallback returned no download options');
  }

  const ext = parsed.isVideo ? 'mp4' : 'jpg';
  const title = 'Instagram Media';
  const formats = parsed.options.slice(0, 8).map((option, index) => ({
    quality:
      option.label ||
      (parsed.isVideo ? `Video ${index + 1}` : `Image ${index + 1}`),
    container: ext,
    url: buildProxyDownloadPath(option.url, title, ext),
    itag: `saveinsta-${index + 1}`,
    hasAudio: parsed.isVideo,
    hasVideo: true,
  }));

  return {
    title,
    thumbnail: parsed.thumbnail
      ? normalizeExternalMediaUrl(parsed.thumbnail, 'https://saveinsta.io/')
      : '/assets/placeholders/media-thumbnail.svg',
    author: 'Instagram User',
    formats,
    audioFormats: [] as Array<{
      quality: string;
      container: string;
      url: string;
      itag: string;
    }>,
  };
};

const fetchYtDlpInfo = async (url: string) =>
  runPythonScriptJson<YtDlpInfo>(YTDLP_INFO_SCRIPT, [url]);

const buildMediaFormats = (
  url: string,
  title: string,
  formats: YtDlpFormat[] = [],
  allowFallbackDownload = true
) => {
  const videoOptions = new Map<
    string,
    {
      quality: string;
      container: string;
      url: string;
      itag: string;
      hasAudio: boolean;
      hasVideo: boolean;
    }
  >();
  const audioOptions = new Map<
    string,
    { quality: string; container: string; url: string; itag: string }
  >();

  for (const fmt of formats) {
    const hasVideo = !!fmt.vcodec && fmt.vcodec !== 'none';
    const hasAudio = !!fmt.acodec && fmt.acodec !== 'none';

    if (hasVideo) {
      const height = fmt.height || 0;
      const key = height ? `${height}` : fmt.ext || 'video';
      if (!videoOptions.has(key)) {
        const quality = height ? `${height}p` : fmt.format_note || 'Best';
        const query = new URLSearchParams({
          url,
          mode: 'video',
          quality: height ? String(height) : '',
          title,
        });
        videoOptions.set(key, {
          quality,
          container: 'mp4',
          url: `/api/media/download?${query.toString()}`,
          itag: fmt.format_id || key,
          hasAudio,
          hasVideo: true,
        });
      }
    }

    if (!hasVideo && hasAudio) {
      const abr = fmt.abr || fmt.tbr || 0;
      const key = abr ? `${Math.round(abr)}` : 'audio';
      if (!audioOptions.has(key)) {
        const query = new URLSearchParams({
          url,
          mode: 'audio',
          title,
        });
        audioOptions.set(key, {
          quality: abr ? `${Math.round(abr)}kbps` : 'Audio',
          container: 'mp3',
          url: `/api/media/download?${query.toString()}`,
          itag: fmt.format_id || key,
        });
      }
    }
  }

  const preferredVideoScore = (quality: string) => {
    const numeric = parseInt(quality, 10);
    if (Number.isNaN(numeric)) return 9999;
    const preferred = [720, 1080, 480, 360, 1440, 2160];
    const exactIndex = preferred.indexOf(numeric);
    if (exactIndex >= 0) return exactIndex;
    if (numeric <= 1080) return preferred.length + Math.abs(720 - numeric);
    return preferred.length + 1000 + numeric;
  };

  const videos = Array.from(videoOptions.values())
    .sort((a, b) => {
      const scoreDiff =
        preferredVideoScore(a.quality) - preferredVideoScore(b.quality);
      if (scoreDiff !== 0) return scoreDiff;
      return parseInt(b.quality, 10) - parseInt(a.quality, 10);
    })
    .slice(0, 4);

  const audios = Array.from(audioOptions.values())
    .sort((a, b) => parseInt(b.quality, 10) - parseInt(a.quality, 10))
    .slice(0, 3);

  if (allowFallbackDownload && videos.length === 0) {
    videos.push({
      quality: 'Best',
      container: 'mp4',
      url: `/api/media/download?${new URLSearchParams({ url, mode: 'video', title }).toString()}`,
      itag: 'best',
      hasAudio: true,
      hasVideo: true,
    });
  }

  if (allowFallbackDownload && audios.length === 0) {
    audios.push({
      quality: 'MP3',
      container: 'mp3',
      url: `/api/media/download?${new URLSearchParams({ url, mode: 'audio', title }).toString()}`,
      itag: 'audio',
    });
  }

  return { videos, audios };
};

const downloadMediaWithYtDlp = async (
  url: string,
  mode: 'video' | 'audio',
  quality?: string
) => {
  const basePath = path.join(
    uploadsDir,
    `media_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
  return runPythonScriptJson<{ path: string; title: string; ext: string }>(
    YTDLP_DOWNLOAD_SCRIPT,
    [mode, url, quality || '', basePath]
  );
};

// Facebook Info
app.get('/api/facebook/info', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    try {
      const info = await withTimeout(
        fetchYtDlpInfo(url),
        20000,
        'facebook yt-dlp'
      );
      const { videos, audios } = buildMediaFormats(
        url,
        info.title || 'Facebook Video',
        info.formats || []
      );
      return res.json({
        title: info.title || 'Facebook Video',
        thumbnail: info.thumbnail || '/assets/placeholders/media-thumbnail.svg',
        author: info.author || 'Facebook User',
        formats: videos,
        audioFormats: audios,
      });
    } catch (ytDlpError: any) {
      console.warn('facebook yt-dlp failed:', ytDlpError.message);
    }

    const cobaltInstances = getCobaltInstances();

    for (const instance of cobaltInstances) {
      try {
        const cobaltResponse = await axios.post(
          instance,
          {
            url: url,
            videoQuality: '720',
            filenameStyle: 'pretty',
          },
          {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Origin: 'https://cobalt.tools',
              Referer: 'https://cobalt.tools/',
            },
            timeout: 10000,
          }
        );

        if (cobaltResponse.data && cobaltResponse.data.url) {
          return res.json({
            title: cobaltResponse.data.filename || 'Facebook Video',
            thumbnail: '/assets/placeholders/media-thumbnail.svg',
            author: 'Facebook User',
            downloadUrl: buildProxyDownloadPath(
              cobaltResponse.data.url,
              cobaltResponse.data.filename || 'Facebook Video',
              'mp4'
            ),
          });
        }
      } catch {}
    }

    const genericFallback = buildMediaFormats(url, 'Facebook Video', [], true);
    return res.json({
      title: 'Facebook Video',
      thumbnail: '/assets/placeholders/media-thumbnail.svg',
      author: 'Facebook User',
      formats: genericFallback.videos,
      audioFormats: genericFallback.audios,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Facebook fetch failed: ' + error.message });
  }
});

const getYoutubeAgent = () => {
  const cookie = (process.env.YT_COOKIE || '').trim();
  const createAgent = (ytdl as any).createAgent;
  if (cookie && typeof createAgent === 'function') {
    try {
      return createAgent(cookie);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

// YouTube Info
app.get('/api/youtube/info', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  let metadata = {
    title: 'YouTube Video',
    thumbnail: '/assets/placeholders/media-thumbnail.svg',
    author: 'YouTube User',
  };

  try {
    const oembedResponse = await axios.get(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );
    if (oembedResponse.data) {
      metadata.title = oembedResponse.data.title;
      metadata.author = oembedResponse.data.author_name;
      metadata.thumbnail = oembedResponse.data.thumbnail_url;
    }
  } catch {
    try {
      const videoId = ytdl.getVideoID(url);
      metadata.thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    } catch {}
  }

  try {
    try {
      const info = await withTimeout(
        fetchYtDlpInfo(url),
        20000,
        'youtube yt-dlp'
      );
      const { videos, audios } = buildMediaFormats(
        url,
        info.title || metadata.title,
        info.formats || []
      );
      return res.json({
        title: info.title || metadata.title,
        thumbnail: info.thumbnail || metadata.thumbnail,
        author: info.author || metadata.author,
        formats: videos,
        audioFormats: audios,
      });
    } catch (ytDlpError: any) {
      console.warn('youtube yt-dlp failed:', ytDlpError.message);
    }

    const cobaltInstances = getCobaltInstances();

    for (const instance of cobaltInstances) {
      try {
        const cobaltResponse = await axios.post(
          instance,
          {
            url: url,
            videoQuality: '720',
            audioFormat: 'mp3',
            filenameStyle: 'pretty',
            downloadMode: 'auto',
            youtubeVideoCodec: 'h264',
          },
          {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Origin: 'https://cobalt.tools',
              Referer: 'https://cobalt.tools/',
            },
            timeout: 10000,
          }
        );

        if (cobaltResponse.data && cobaltResponse.data.url) {
          const proxiedDownload = buildProxyDownloadPath(
            cobaltResponse.data.url,
            metadata.title,
            'mp4'
          );
          return res.json({
            ...metadata,
            formats: [
              {
                quality: '720p',
                container: 'mp4',
                url: proxiedDownload,
                hasAudio: true,
                hasVideo: true,
                itag: 'cobalt',
              },
            ],
            audioFormats: [
              {
                quality: '128kbps',
                container: 'mp3',
                url: buildProxyDownloadPath(
                  cobaltResponse.data.url,
                  metadata.title,
                  'mp3'
                ),
                itag: 'cobalt',
              },
            ],
          });
        }
      } catch (e: any) {
        const status = e.response?.status;
        const message = e.message;
        console.warn(`Cobalt instance ${instance} failed:`, status || message);
      }
    }

    try {
      const agent = getYoutubeAgent();
      if (ytdl.validateURL(url)) {
        const info = await ytdl.getInfo(url, {
          agent,
          requestOptions: {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
          },
        });

        const formats = ytdl.filterFormats(info.formats, 'audioandvideo');
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');

        if (formats.length > 0) {
          return res.json({
            title: info.videoDetails.title,
            thumbnail:
              info.videoDetails.thumbnails[
                info.videoDetails.thumbnails.length - 1
              ].url,
            author: info.videoDetails.author.name,
            formats: formats.map((f) => ({
              quality: f.qualityLabel || '720p',
              container: f.container,
              url: f.url,
              hasAudio: f.hasAudio,
              hasVideo: f.hasVideo,
              itag: f.itag,
            })),
            audioFormats: audioFormats.map((f) => ({
              quality: f.audioBitrate + 'kbps',
              container: f.container,
              url: f.url,
              itag: f.itag,
            })),
          });
        }
      }
    } catch (ytdlError: any) {
      console.warn('ytdl failed:', ytdlError.message);
    }

    try {
      const vkrResponse = await axios.get(
        `https://vkrdownloader.com/server?v=${encodeURIComponent(url)}`,
        { timeout: 10000 }
      );
      if (vkrResponse.data && vkrResponse.data.data) {
        const data = vkrResponse.data.data;
        return res.json({
          ...metadata,
          title: data.title || metadata.title,
          thumbnail: data.thumbnail || metadata.thumbnail,
          formats:
            data.downloads
              ?.filter((d: any) => d.type === 'video')
              .map((d: any) => ({
                quality: d.quality || '720p',
                container: 'mp4',
                url: buildProxyDownloadPath(
                  d.url,
                  data.title || metadata.title,
                  'mp4'
                ),
                hasAudio: true,
                hasVideo: true,
                itag: 'vkr',
              })) || [],
          audioFormats:
            data.downloads
              ?.filter((d: any) => d.type === 'audio')
              .map((d: any) => ({
                quality: d.quality || '128kbps',
                container: 'mp3',
                url: buildProxyDownloadPath(
                  d.url,
                  data.title || metadata.title,
                  'mp3'
                ),
                itag: 'vkr',
              })) || [],
        });
      }
    } catch (vkrError: any) {
      console.warn('vkrdownloader failed:', vkrError.message);
    }

    const fallbackTitle = metadata.title || 'YouTube Video';
    return res.json({
      ...metadata,
      warning:
        'Direct format detection was blocked, so VinzaTools switched to the server-side yt-dlp fallback for download.',
      formats: [
        {
          quality: 'Best available',
          container: 'mp4',
          url: `/api/media/download?url=${encodeURIComponent(url)}&mode=video&title=${encodeURIComponent(fallbackTitle)}`,
          hasAudio: true,
          hasVideo: true,
          itag: 'server-fallback',
        },
      ],
      audioFormats: [
        {
          quality: 'Best available',
          container: 'mp3',
          url: `/api/media/download?url=${encodeURIComponent(url)}&mode=audio&title=${encodeURIComponent(fallbackTitle)}`,
          itag: 'server-fallback',
        },
      ],
    });
  } catch (error: any) {
    console.error('YouTube Info Error:', error);
    res
      .status(500)
      .json({ error: 'Failed to fetch YouTube info: ' + error.message });
  }
});

// YouTube Download Proxy
app.get('/api/youtube/download', async (req, res) => {
  const { url, itag, title, downloadUrl, ext } = req.query;
  const requestedExt =
    typeof ext === 'string' && ext.trim() ? ext.trim() : undefined;

  if (downloadUrl && typeof downloadUrl === 'string') {
    try {
      const response = await axios({
        method: 'get',
        url: downloadUrl,
        responseType: 'stream',
        maxRedirects: 5,
        timeout: 120000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: '*/*',
          'Accept-Encoding': 'identity',
          Connection: 'keep-alive',
        },
      });

      const contentType = response.headers['content-type'] || 'video/mp4';
      const sniffExtension = (chunk: Buffer) => {
        if (
          chunk.length >= 12 &&
          chunk.slice(4, 8).toString('ascii') === 'ftyp'
        ) {
          const brand = chunk.slice(8, 12).toString('ascii');
          if (brand.startsWith('M4A') || brand === 'M4A ') return 'm4a';
          return 'mp4';
        }
        if (
          chunk.length >= 4 &&
          chunk[0] === 0x1a &&
          chunk[1] === 0x45 &&
          chunk[2] === 0xdf &&
          chunk[3] === 0xa3
        ) {
          return 'webm';
        }
        if (
          chunk.length >= 3 &&
          chunk[0] === 0x49 &&
          chunk[1] === 0x44 &&
          chunk[2] === 0x33
        ) {
          return 'mp3';
        }
        if (
          chunk.length >= 2 &&
          chunk[0] === 0xff &&
          (chunk[1] & 0xe0) === 0xe0
        ) {
          return 'mp3';
        }
        return undefined;
      };

      let extension = requestedExt || 'mp4';
      if (contentType.includes('audio')) extension = 'mp3';
      else if (contentType.includes('webm')) extension = 'webm';
      else if (contentType.includes('mp4')) extension = requestedExt || 'mp4';
      else if (contentType.includes('mpeg')) extension = 'mp3';

      const setHeaders = () => {
        const filename = `${title || 'video'}.${extension}`;
        res.setHeader('Content-Disposition', contentDisposition(filename));
        res.setHeader('Content-Type', contentType);
        if (response.headers['content-length'])
          res.setHeader('Content-Length', response.headers['content-length']);
      };

      const stream = response.data;
      stream.once('data', (chunk: Buffer) => {
        const sniffed = sniffExtension(chunk);
        if (sniffed) {
          extension = sniffed;
        }
        setHeaders();
        res.write(chunk);
        stream.pipe(res);
      });
      return;
    } catch (e: any) {
      console.error('Proxy download failed:', e.message);
      return res.redirect(downloadUrl);
    }
  }

  if (!url || typeof url !== 'string' || !itag) {
    return res.status(400).send('Missing parameters');
  }

  try {
    const agent = getYoutubeAgent();
    const extension = requestedExt || 'mp4';
    res.setHeader(
      'Content-Disposition',
      contentDisposition(`${title || 'video'}.${extension}`)
    );
    ytdl(url, {
      quality: itag as string,
      agent,
    }).pipe(res);
  } catch {
    res.status(500).send('Download failed');
  }
});

// Universal Download Proxy (TikTok/Instagram)
app.get('/api/media/download', async (req, res) => {
  const { url, mode, quality, title } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).send('URL required');
  }

  const requestedMode = mode === 'audio' ? 'audio' : 'video';

  try {
    const payload = await downloadMediaWithYtDlp(
      url,
      requestedMode,
      typeof quality === 'string' ? quality : undefined
    );

    if (!payload?.path || !fs.existsSync(payload.path)) {
      throw new Error('Downloaded file missing');
    }

    const ext = (
      payload.ext || (requestedMode === 'audio' ? 'mp3' : 'mp4')
    ).replace(/^\./, '');
    const baseName = sanitizeFilename(
      typeof title === 'string' && title.trim()
        ? title
        : payload.title || 'media',
      requestedMode === 'audio' ? 'audio' : 'video'
    );

    sendDownloadedFile(res, payload.path, `${baseName}.${ext}`);
  } catch (error: any) {
    console.error('yt-dlp download failed:', error.message);
    res.status(500).json({ error: 'Failed to download media.' });
  }
});

app.get('/api/proxy-download', async (req, res) => {
  const { url, title, ext } = req.query;
  if (!url || typeof url !== 'string')
    return res.status(400).send('URL required');

  try {
    const axiosConfig: any = {
      method: 'get',
      url: url,
      responseType: 'stream',
      maxRedirects: 5,
      timeout: 120000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: '*/*',
        'Accept-Encoding': 'identity',
        Connection: 'keep-alive',
      },
    };

    if (url.includes('tikwm.com')) {
      axiosConfig.headers['Referer'] = 'https://www.tikwm.com/';
    }

    const response = await axios(axiosConfig);

    if (response.status !== 200) {
      console.warn('Proxy received non-200 status:', response.status);
      return res.redirect(url);
    }

    const contentType = response.headers['content-type'] || '';
    if (
      contentType.includes('text/html') ||
      contentType.includes('application/json')
    ) {
      console.warn('Proxy received invalid content type:', contentType);
      return res.redirect(url);
    }

    let extension = ext || 'mp4';
    if (contentType.includes('audio')) extension = 'mp3';
    else if (contentType.includes('webm')) extension = 'webm';

    const safeTitle = ((title as string) || 'media')
      .replace(/[^\w\s-]/gi, '')
      .substring(0, 50);
    const filename = `${safeTitle}.${extension}`;

    res.setHeader('Content-Disposition', contentDisposition(filename));
    res.setHeader('Content-Type', contentType);
    if (response.headers['content-length'])
      res.setHeader('Content-Length', response.headers['content-length']);

    response.data.pipe(res);
  } catch (e: any) {
    console.error('Universal proxy download failed:', e.message);
    res.redirect(url);
  }
});

// TikTok Info
app.get('/api/tiktok/info', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    try {
      const info = await withTimeout(
        fetchYtDlpInfo(url),
        20000,
        'tiktok yt-dlp'
      );
      const { videos, audios } = buildMediaFormats(
        url,
        info.title || 'TikTok Video',
        info.formats || []
      );
      return res.json({
        title: info.title || 'TikTok Video',
        thumbnail: info.thumbnail || '/assets/placeholders/media-thumbnail.svg',
        author: info.author || 'TikTok User',
        formats: videos,
        audioFormats: audios,
      });
    } catch (ytDlpError: any) {
      console.warn('tiktok yt-dlp failed:', ytDlpError.message);
    }

    const cobaltInstances = getCobaltInstances();

    for (const instance of cobaltInstances) {
      try {
        const cobaltResponse = await axios.post(
          instance,
          {
            url: url,
            videoQuality: '720',
            audioFormat: 'mp3',
            filenameStyle: 'pretty',
            isNoTTWatermark: true,
          },
          {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Origin: 'https://cobalt.tools',
              Referer: 'https://cobalt.tools/',
            },
            timeout: 10000,
          }
        );

        if (cobaltResponse.data && cobaltResponse.data.url) {
          return res.json({
            title: cobaltResponse.data.filename || 'TikTok Video',
            thumbnail: '/assets/placeholders/media-thumbnail.svg',
            author: 'TikTok User',
            downloadUrl: buildProxyDownloadPath(
              cobaltResponse.data.url,
              cobaltResponse.data.filename || 'TikTok Video',
              'mp4'
            ),
          });
        }
      } catch {}
    }

    try {
      const response = await axios.get(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
        { timeout: 10000 }
      );
      const data = response.data;

      if (data.code === 0) {
        const title = data.data.title || 'TikTok Video';
        return res.json({
          title,
          thumbnail: data.data.cover,
          author: data.data.author.nickname,
          downloadUrl: buildProxyDownloadPath(
            data.data.play,
            title,
            'mp4',
            'https://www.tikwm.com/'
          ),
          music: data.data.music,
        });
      }
    } catch {}

    const genericFallback = buildMediaFormats(url, 'TikTok Video', [], true);
    return res.json({
      title: 'TikTok Video',
      thumbnail: '/assets/placeholders/media-thumbnail.svg',
      author: 'TikTok User',
      formats: genericFallback.videos,
      audioFormats: genericFallback.audios,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'TikTok fetch failed: ' + error.message });
  }
});

// Instagram Info
app.get('/api/instagram/info', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    try {
      const info = await withTimeout(
        fetchYtDlpInfo(url),
        20000,
        'instagram yt-dlp'
      );
      const { videos, audios } = buildMediaFormats(
        url,
        info.title || 'Instagram Media',
        info.formats || [],
        false
      );
      if (videos.length > 0 || audios.length > 0) {
        return res.json({
          title: info.title || 'Instagram Media',
          thumbnail:
            info.thumbnail || '/assets/placeholders/media-thumbnail.svg',
          author: info.author || 'Instagram User',
          formats: videos,
          audioFormats: audios,
        });
      }
    } catch (ytDlpError: any) {
      console.warn('instagram yt-dlp failed:', ytDlpError.message);
    }

    const cobaltInstances = getCobaltInstances();

    for (const instance of cobaltInstances) {
      try {
        const cobaltResponse = await axios.post(
          instance,
          {
            url: url,
            videoQuality: '720',
            audioFormat: 'mp3',
            filenameStyle: 'pretty',
          },
          {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Origin: 'https://cobalt.tools',
              Referer: 'https://cobalt.tools/',
            },
            timeout: 10000,
          }
        );

        if (cobaltResponse.data && cobaltResponse.data.url) {
          return res.json({
            title: cobaltResponse.data.filename || 'Instagram Media',
            thumbnail: '/assets/placeholders/media-thumbnail.svg',
            downloadUrl: buildProxyDownloadPath(
              cobaltResponse.data.url,
              cobaltResponse.data.filename || 'Instagram Media',
              'mp4'
            ),
          });
        }
      } catch {}
    }

    try {
      const fallback = await fetchInstagramViaSaveInsta(url);
      return res.json(fallback);
    } catch (saveInstaError: any) {
      console.warn('instagram saveinsta failed:', saveInstaError.message);
    }

    res
      .status(400)
      .json({
        error:
          'Failed to fetch Instagram media. Providers are blocked or down. Set COBALT_BASE_URL to your own server for reliable downloads.',
      });
  } catch (error: any) {
    res.status(500).json({ error: 'Instagram fetch failed: ' + error.message });
  }
});

// Poster Studio AI Copy
app.post('/api/poster/generate', async (_req, res) => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.startsWith('YOUR_')) {
    return res.status(400).json({ error: 'GEMINI_API_KEY is missing' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents:
        'Generate professional corporate poster content for a high-end tech networking event. Return JSON with keys: heading, body, highlight, contact, buttonText, logoText. Keep it concise and professional.',
      config: { responseMimeType: 'application/json' },
    });
    const payload = JSON.parse(response.text || '{}');
    res.json(payload);
  } catch (error: any) {
    console.error('Poster AI failed:', error);
    res.status(500).json({ error: 'Poster AI generation failed' });
  }
});

// --- RESUME PDF GENERATION ---
app.post('/api/resume/generate', async (req, res) => {
  try {
    const data = req.body;
    // In a real production app, we'd use a templating engine or puppeteer
    // For this environment, we'll return a JSON that the client can use to trigger a client-side download
    // OR we can use pdf-lib to draw text. Drawing a full resume with pdf-lib is complex.
    // Let's use a simpler approach: the client sends a dataURL of the rendered resume (from html2canvas)
    // and the server converts it to a proper PDF.

    const { imageData } = req.body;
    if (!imageData)
      return res.status(400).json({ error: 'Image data required' });

    const base64Image = imageData.split(',')[1];
    const imgBuffer = Buffer.from(base64Image, 'base64');

    const pdfDoc = await PDFDocument.create();
    const image = await pdfDoc.embedPng(imgBuffer);
    const { width, height } = image.scale(1);

    const page = pdfDoc.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });

    const pdfBytes = await pdfDoc.save();
    const outputPath = path.join('uploads', `resume_${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, pdfBytes);

    res.download(outputPath, 'resume.pdf', () => fs.unlinkSync(outputPath));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Resume generation failed' });
  }
});

// --- VITE MIDDLEWARE ---
const listenWithFallback = async () => {
  const maxPort = BASE_PORT + 10;
  for (let port = BASE_PORT; port <= maxPort; port += 1) {
    try {
      await new Promise<void>((resolve, reject) => {
        const server = app.listen(port, '0.0.0.0', () => resolve());
        server.on('error', (err) => {
          try {
            server.close();
          } catch {
            // ignore
          }
          reject(err);
        });
      });
      return port;
    } catch (err: any) {
      if (err?.code !== 'EADDRINUSE') {
        throw err;
      }
    }
  }
  throw new Error('No available port found');
};

async function startServer() {
  await initDb();
  if (databaseMode === 'mysql') {
    console.log(
      `MySQL connected: ${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`
    );
  } else {
    console.log(`SQLite fallback connected: ${sqliteDbPath}`);
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Return 404 for /cgi-bin paths — Google scans these but the route doesn't exist
    app.get(['/cgi-bin', '/cgi-bin/*'], (_req, res) => {
      res.status(404).type('text').send('Not Found');
    });
    // redirect:false prevents express from 301-redirecting /tools/foo → /tools/foo/
    // That redirect causes a canonical URL mismatch in Google Search Console because
    // the generated HTML canonicals omit the trailing slash.
    app.use(express.static('dist', { redirect: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  activePort = await listenWithFallback();
  console.log(`Server running on http://localhost:${activePort}`);
  for (const lanUrl of getLanUrls(activePort)) {
    console.log(`LAN access available at ${lanUrl}`);
  }
}

startServer();
