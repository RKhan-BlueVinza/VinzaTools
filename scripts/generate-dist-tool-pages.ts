import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTERNAL_TOOLS } from '../src/data/toolCatalog';

const SITE = 'https://www.vinzatools.com';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');

const indexHtmlPath = path.join(distDir, 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
  console.error('dist/index.html not found. Run build first.');
  process.exit(1);
}

const baseHtml = fs.readFileSync(indexHtmlPath, 'utf8');

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

// Normalize multi-line <meta .../> or <meta ...> tags to single-line so regex removal works cleanly.
const normalizeMetas = (html: string) =>
  html.replace(/<meta\b[\s\S]*?(?:\/?>)/gi, (m) => m.replace(/\s+/g, ' '));

// Remove a meta tag by name or property attribute (single-line after normalization).
const removeMetaByName = (html: string, name: string) =>
  html.replace(new RegExp(`<meta [^>]*name=["']${name}["'][^>]*>\\s*`, 'gi'), '');
const removeMetaByProp = (html: string, prop: string) =>
  html.replace(new RegExp(`<meta [^>]*property=["']${prop}["'][^>]*>\\s*`, 'gi'), '');
const removeLink = (html: string, rel: string) =>
  html.replace(new RegExp(`<link [^>]*rel=["']${rel}["'][^>]*>\\s*`, 'gi'), '');

// Keyword-rich SEO titles for top tools. Pattern: [Action Keyword] Free Online – [Benefit] | VinzaTools
const RICH_TITLES: Record<string, string> = {
  'bg-remover': 'AI Background Remover – Remove BG Free Online | VinzaTools',
  'media-youtube': 'Free YouTube Video Downloader – MP4 & MP3 | VinzaTools',
  'pdf-to-word': 'PDF to Word Converter – Free & Accurate Online | VinzaTools',
  'media-tiktok': 'Free TikTok Downloader – No Watermark | VinzaTools',
  'media-instagram': 'Instagram Downloader – Photos & Reels Free | VinzaTools',
  'media-facebook': 'Facebook Video Downloader – Free & No Watermark | VinzaTools',
  'image-compressor': 'Free Image Compressor – Reduce Size Online | VinzaTools',
  'pdf-merge': 'Merge PDF Files Free Online – Combine PDFs | VinzaTools',
  'pdf-compress': 'Compress PDF Free Online – Reduce File Size | VinzaTools',
  'jpg-to-pdf': 'JPG to PDF Converter – Free & Fast Online | VinzaTools',
  'pdf-to-jpg': 'PDF to JPG Converter – Free & High Quality | VinzaTools',
  'resume-builder': 'Free Resume Builder – ATS-Ready Templates | VinzaTools',
  'qr-code-generator': 'Free QR Code Generator – Custom & Branded | VinzaTools',
  'word-to-pdf': 'Word to PDF Converter – Free Online Converter | VinzaTools',
  'pdf-split': 'Split PDF Free Online – Extract Pages Instantly | VinzaTools',
  'image-converter': 'Free Image Converter – JPG PNG WEBP Online | VinzaTools',
  'mp4-to-mp3': 'MP4 to MP3 Converter – Extract Audio Free | VinzaTools',
  'video-to-gif': 'Video to GIF Converter – Free Online Tool | VinzaTools',
  'password-generator': 'Free Password Generator – Strong & Secure | VinzaTools',
  'color-palette-generator': 'Color Palette Generator – Free Brand Colors | VinzaTools',
  'crop-image': 'Crop Image Free Online – No Signup Required | VinzaTools',
  'resize-image': 'Resize Image Free Online – Custom Dimensions | VinzaTools',
  'ppt-to-pdf': 'PowerPoint to PDF – Free Online Converter | VinzaTools',
  'pdf-to-ppt': 'PDF to PowerPoint – Free Online Converter | VinzaTools',
  'pdf-to-excel': 'PDF to Excel – Free Online Converter | VinzaTools',
  'excel-to-pdf': 'Excel to PDF – Free Online Converter | VinzaTools',
  'html-to-pdf': 'HTML to PDF Converter – Free Online Tool | VinzaTools',
  'edit-pdf': 'Edit PDF Free Online – No Signup Needed | VinzaTools',
  'protect-pdf': 'Protect PDF with Password – Free Online | VinzaTools',
  'unlock-pdf': 'Unlock PDF Free Online – Remove Password | VinzaTools',
  'sign-pdf': 'Sign PDF Free Online – Add Signature Easily | VinzaTools',
  'slug-generator': 'URL Slug Generator – Free SEO-Friendly Slugs | VinzaTools',
  'text-counter': 'Word & Character Counter – Free Online Tool | VinzaTools',
  'case-converter': 'Text Case Converter – Free Online Tool | VinzaTools',
  'video-converter': 'Free Video Converter – MP4 MOV WEBM Online | VinzaTools',
  'audio-converter': 'Free Audio Converter – MP3 WAV OGG Online | VinzaTools',
  'gif-maker': 'Free GIF Maker – Create Animated GIFs Online | VinzaTools',
};

// Rich descriptions for high-traffic tools (keep under 155 chars).
const RICH_DESCRIPTIONS: Record<string, string> = {
  'bg-remover': 'Free AI background remover — upload any photo and get a transparent PNG in seconds. No Photoshop, no signup, works on any image.',
  'pdf-to-word': 'Free PDF to Word converter online. Upload PDF, download editable DOCX instantly — accurate formatting, no signup, no watermark.',
  'media-youtube': 'Free YouTube video downloader — save MP4 in HD or extract MP3 audio. No account needed, no watermark, instant download online.',
  'media-tiktok': 'Download TikTok videos without watermark free. Save HD reels and clips in seconds — no login, no app required on VinzaTools.',
  'media-instagram': 'Download Instagram reels, videos, and photos free. No account needed — fast, watermark-free download on VinzaTools.',
  'media-facebook': 'Download Facebook videos free — save public video content in HD with no watermark and no signup required on VinzaTools.',
  'pdf-merge': 'Merge multiple PDF files into one document online. Combine PDFs in any order and download instantly — free, no signup needed.',
  'pdf-compress': 'Compress PDF file size online while keeping quality. Reduce large PDFs for email or sharing — free PDF compressor, instant download.',
  'image-compressor': 'Free image compressor online — reduce JPG, PNG, and WEBP file size without losing quality. Instant download, no signup, no upload limit.',
  'qr-code-generator': 'Create custom QR codes for URLs, contacts, and campaigns online. Branded QR codes with logo support — free, instant PNG download.',
  'resume-builder': 'Build a professional ATS-ready resume with modern templates. Download as PDF or Word — free resume builder online, no signup.',
  'word-to-pdf': 'Convert Word document to PDF online for free. Upload DOCX and download a clean PDF instantly — no software, no signup on VinzaTools.',
  'jpg-to-pdf': 'Convert JPG images to PDF online for free. Combine multiple JPGs into one PDF document — fast, no signup, instant download.',
  'image-converter': 'Convert images between JPG, PNG, WEBP, and JPEG formats online. Free batch image converter — instant download, no signup needed.',
  'webp-to-png': 'Convert WEBP to PNG online for free. Upload WEBP and download a lossless PNG instantly — no signup needed on VinzaTools.',
  'heic-to-jpg': 'Convert iPhone HEIC photos to JPG online for free. Fast HEIC to JPG converter — no software needed, download instantly.',
  'heic-to-png': 'Convert iPhone HEIC photos to PNG online for free. Fast HEIC to PNG converter — no software needed, instant download.',
  'webp-to-jpg': 'Convert WEBP images to JPG online for free. Upload WEBP and download a clean JPG file instantly — no signup on VinzaTools.',
  'pdf-split': 'Split PDF into multiple files online for free. Extract specific pages or ranges — fast PDF splitter, no signup on VinzaTools.',
  'pdf-to-jpg': 'Convert PDF pages to JPG images online for free. Export each page as a high-quality JPG — no signup, instant download.',
  'poster-maker': 'Create posters, flyers, and banners online for free. Design with clean layouts and download as PNG or PDF — no signup required.',
  'password-generator': 'Generate strong, secure passwords online. Customize length and character rules — free password generator, instant copy on VinzaTools.',
  'color-palette-generator': 'Generate professional color palettes for branding and design. Create brand color schemes and export HEX codes — free online tool.',
  'text-counter': 'Count words, characters, and sentences instantly online. Free word counter — paste any text and get results immediately on VinzaTools.',
  'pdf-to-excel': 'Convert PDF to Excel spreadsheet online for free. Extract tables and data from PDFs into XLSX — no signup, instant download.',
  'pdf-to-ppt': 'Convert PDF to PowerPoint slides online for free. Turn PDF pages into editable PPT — fast, no signup, instant download on VinzaTools.',
  'jfif-to-png': 'Convert JFIF images to PNG format online for free. Upload JFIF and download a clean PNG instantly — no signup on VinzaTools.',
  'mp4-to-mp3': 'Extract MP3 audio from MP4 video online for free. Convert MP4 to MP3 instantly — no signup, fast download on VinzaTools.',
  'video-to-gif': 'Convert video clips to animated GIF online for free. Turn MP4, WEBM, or MOV into GIF — fast, no signup on VinzaTools.',
  'shopify-helper': 'Extract product details and export Shopify-ready product sheets with a professional workflow. Free Shopify product tool on VinzaTools.',
  'video-converter': 'Convert video to MP4, MOV, WEBM, or GIF online for free. Fast video format converter — no signup, instant download on VinzaTools.',
  'audio-converter': 'Convert audio files to MP3, WAV, OGG, or AAC online for free. Fast audio format converter — no signup, instant download on VinzaTools.',
  'mp4-converter': 'Convert video files to MP4 online for free. Fast MP4 converter — no signup, supports MOV, AVI, WEBM, and more on VinzaTools.',
  'mov-to-mp4': 'Convert MOV to MP4 online for free. Fast MOV to MP4 converter — no software needed, instant download on VinzaTools.',
  'gif-maker': 'Create animated GIFs from images online for free. Upload photos and build a GIF instantly — no signup, fast export on VinzaTools.',
  'crop-image': 'Crop images online for free. Upload any photo and crop to the exact area you need — instant download, no signup on VinzaTools.',
  'resize-image': 'Resize images online for free. Set custom width and height and download instantly — no signup needed on VinzaTools.',
  'rotate-image': 'Rotate images online for free. Rotate any photo left or right and download instantly — no signup needed on VinzaTools.',
  'flip-image': 'Flip images online for free. Mirror photos horizontally or vertically — instant download, no signup on VinzaTools.',
  'image-enlarger': 'Enlarge images online for free. Upscale photos for print or preview — no signup, instant download on VinzaTools.',
  'color-picker': 'Pick colors from any image online for free. Upload a photo and sample exact HEX colors — no signup needed on VinzaTools.',
  'edit-pdf': 'Edit PDF online for free. Add text edits to your PDF and download instantly — no software, no signup on VinzaTools.',
  'watermark-pdf': 'Add watermark to PDF online for free. Apply text or image watermarks across all pages — no signup, instant download on VinzaTools.',
  'sign-pdf': 'Sign PDF online for free. Upload and place your signature on any PDF — no software, no signup on VinzaTools.',
  'protect-pdf': 'Protect PDF with password online for free. Add password protection to any PDF — no signup, instant download on VinzaTools.',
  'unlock-pdf': 'Remove PDF password online for free. Unlock protected PDFs and download instantly — no signup needed on VinzaTools.',
  'ocr-pdf': 'Extract text from scanned PDF online for free. OCR tool to get editable text from PDF images — no signup on VinzaTools.',
  'ppt-to-pdf': 'Convert PowerPoint to PDF online for free. Upload PPT or PPTX and download a clean PDF — no signup, instant download.',
  'excel-to-pdf': 'Convert Excel to PDF online for free. Upload XLS or XLSX and download a clean PDF instantly — no signup on VinzaTools.',
  'html-to-pdf': 'Convert HTML to PDF online for free. Paste HTML and download as a formatted PDF — no signup on VinzaTools.',
  'pdf-page-remover': 'Remove pages from PDF online for free. Delete unwanted pages and download a clean PDF — no signup on VinzaTools.',
  'extract-pages-from-pdf': 'Extract pages from PDF online for free. Select specific pages and save them as a new PDF — no signup on VinzaTools.',
  'organize-pdf': 'Reorder PDF pages online for free. Arrange pages in any custom order and download — no signup on VinzaTools.',
  'compare-pdf': 'Compare two PDF files online for free. View differences side by side — no signup, fast PDF comparison on VinzaTools.',
  'redact-pdf': 'Redact PDF online for free. Remove or black out sensitive text from PDFs — no signup, instant download on VinzaTools.',
  'translate-pdf': 'Translate PDF online for free. Convert PDF text to another language — no signup, instant result on VinzaTools.',
  'case-converter': 'Convert text to uppercase, lowercase, or title case online for free. Instant case conversion — no signup on VinzaTools.',
  'slug-generator': 'Generate SEO-friendly URL slugs online for free. Create clean slugs for pages, posts, and products — no signup on VinzaTools.',
  'keyword-density-checker': 'Check keyword density in your content for free. Analyze keyword frequency and SEO focus — no signup on VinzaTools.',
  'url-encoder': 'Encode or decode URLs online for free. Convert special characters for APIs and links — no signup on VinzaTools.',
  'mp4-to-gif': 'Convert MP4 to GIF online for free. Turn MP4 video clips into animated GIFs — no signup, instant download on VinzaTools.',
  'video-to-gif': 'Convert video to GIF online for free. Turn any video clip into an animated GIF — no signup, instant download on VinzaTools.',
  'crop-video': 'Crop video online for free. Trim the frame area of your video and export a clean file — no signup on VinzaTools.',
  'trim-video': 'Trim video online for free. Cut the start and end of a video clip — no signup, instant download on VinzaTools.',
  'mp4-to-mp3': 'Convert MP4 to MP3 online for free. Extract audio from video files instantly — no signup, fast download on VinzaTools.',
};

// Category-level base keywords appended to every tool page.
const CATEGORY_BASE_KEYWORDS: Record<string, string> = {
  pdf: 'pdf tools, free pdf converter online, pdf editor, merge pdf, split pdf',
  image: 'image tools, image converter, free image editor, photo tools online',
  media: 'video downloader, media downloader, free video download, online downloader',
  creative: 'creative tools, design tools, free online design maker, graphic tool',
  text: 'text tools, writing tools, seo tools, free text utilities',
  developer: 'developer tools, dev utilities, free coding tools, web developer tools',
};

const buildKeywords = (toolId: string, toolName: string, category: string): string => {
  const catKeywords = CATEGORY_BASE_KEYWORDS[category] || 'online tools, free tools';
  return `${toolName.toLowerCase()}, ${catKeywords}, VinzaTools, vinzatools.com`;
};

const buildLdJson = (toolName: string, metaDesc: string, canonical: string): string =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: toolName,
    description: metaDesc,
    applicationCategory: 'WebApplication',
    operatingSystem: 'All',
    url: canonical,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: 'VinzaTools', url: SITE },
  });

// How-to steps per category (shown in noscript for crawlers).
const HOW_TO_USE: Record<string, string> = {
  pdf: 'Upload your PDF file using the upload button or drag-and-drop area. Configure any options needed for your task. Click the Process button. Your result downloads automatically — no software installation, no account required.',
  image: 'Upload your image using the upload button or drag and drop it into the tool. Set your preferred options such as format, quality, or dimensions. Click Process and preview the result. Download your converted image instantly.',
  media: 'Copy the video URL from YouTube, TikTok, Instagram, or Facebook. Paste it into the URL field. Choose your preferred format (MP4, MP3, or HD video). Click Download and save the file to your device. No account or app needed.',
  creative: 'Fill in your content details or upload your assets into the editor. Customize the design using available options. Click Export to save your file as PNG, PDF, or your preferred format.',
  text: 'Paste or type your text into the input box. The tool processes your text instantly and shows results in real time. Copy the result or download it as a file.',
  developer: 'Paste your input data (code, URL, or text) into the tool. Configure any available options. Click Process to see the result instantly. Copy the output or download it directly.',
};

// Key benefits per category (shown as bullet points in noscript).
const KEY_FEATURES: Record<string, string[]> = {
  pdf: ['Works on all PDF types — scanned or digital', 'No file size restrictions for common operations', 'Your files are processed securely and not stored', 'Download results instantly after processing'],
  image: ['Supports JPG, PNG, WEBP, HEIC, and more formats', 'Process images without installing any software', 'Preview before downloading', 'Works on all devices including mobile'],
  media: ['Download in HD quality when available', 'No watermark on downloaded files', 'Supports YouTube, TikTok, Instagram, and Facebook', 'Works in any browser, no app installation needed'],
  creative: ['Professional-quality output in PDF or PNG', 'Multiple templates and layout options', 'No design experience required', 'Download and use for any purpose'],
  text: ['Instant results as you type', 'Supports long-form text and documents', 'No word count limits', 'Copy or download results easily'],
  developer: ['Handles large inputs efficiently', 'Clean formatted output ready to use', 'No registration or API key needed', 'Works across all major browsers'],
};

const buildToolPage = (toolId: string, toolName: string, description: string, category: string, relatedTools: Array<{ id: string; name: string }>): string => {
  const title = RICH_TITLES[toolId] || `${toolName} Free Online | VinzaTools`;
  const canonical = `${SITE}/tools/${encodeURIComponent(toolId)}`;
  const rawDesc = RICH_DESCRIPTIONS[toolId] ||
    `Free online ${toolName.toLowerCase()} on VinzaTools. ${description.trimEnd().replace(/\.$/, '')} — no signup required, instant download.`;
  // Hard limit at 155 chars (Google truncates after this).
  const metaDesc = rawDesc.length > 155 ? rawDesc.slice(0, 152) + '...' : rawDesc;

  let html = baseHtml;

  // Normalize multi-line meta tags before regex removal.
  html = normalizeMetas(html);

  // Strip all meta/link tags we will re-inject with tool-specific values.
  html = removeMetaByName(html, 'description');
  html = removeMetaByName(html, 'keywords');
  html = removeMetaByName(html, 'robots');
  html = removeMetaByName(html, 'twitter:card');
  html = removeMetaByName(html, 'twitter:title');
  html = removeMetaByName(html, 'twitter:description');
  html = removeMetaByName(html, 'twitter:image');
  html = removeMetaByProp(html, 'og:title');
  html = removeMetaByProp(html, 'og:description');
  html = removeMetaByProp(html, 'og:url');
  html = removeMetaByProp(html, 'og:image');
  html = removeMetaByProp(html, 'og:site_name');
  html = removeLink(html, 'canonical');

  // Replace LD+JSON with SoftwareApplication schema.
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/i,
    `<script type="application/ld+json">${buildLdJson(toolName, metaDesc, canonical)}</script>`
  );

  // Replace title.
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);

  const ogImg = `${SITE}/assets/images/vinzatools-og.png`;
  const keywords = buildKeywords(toolId, toolName, category);

  const headBlock = [
    `<link rel="canonical" href="${canonical}">`,
    `<meta name="description" content="${escapeHtml(metaDesc)}">`,
    `<meta name="keywords" content="${escapeHtml(keywords)}">`,
    `<meta name="robots" content="index, follow">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(metaDesc)}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${ogImg}">`,
    `<meta property="og:site_name" content="VinzaTools">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(metaDesc)}">`,
    `<meta name="twitter:image" content="${ogImg}">`,
  ].join('\n');
  html = html.replace('</head>', `${headBlock}\n</head>`);

  // Rich noscript block — gives crawlers real readable content.
  const howToUse = HOW_TO_USE[category] || 'Open the tool, upload your file or enter your input, then click Process to get your result instantly.';
  const relatedLinksHtml = relatedTools.length > 0
    ? `<p style="margin-top:20px;"><strong>Related tools:</strong><br style="margin-bottom:6px;">${relatedTools.map(t => `<a href="${SITE}/tools/${encodeURIComponent(t.id)}" style="color:#e11d48;margin-right:14px;display:inline-block;margin-top:4px;">${escapeHtml(t.name)}</a>`).join('')}</p>`
    : '';

  const keyFeatures = KEY_FEATURES[category] || ['Free to use — no signup required', 'Works in any browser', 'Instant results with no waiting', 'Secure processing — files are not stored'];
  const featureBulletsHtml = `<ul style="color:#444;padding-left:20px;margin-bottom:16px;">${keyFeatures.map(f => `<li style="margin-bottom:4px;">${escapeHtml(f)}</li>`).join('')}</ul>`;

  const noscript = [
    `<noscript>`,
    `<main style="max-width:760px;margin:40px auto;font-family:Arial,sans-serif;line-height:1.7;padding:0 16px;">`,
    `<nav style="font-size:13px;margin-bottom:16px;"><a href="${SITE}" style="color:#e11d48;text-decoration:none;">VinzaTools</a> &rsaquo; <a href="${SITE}/tools" style="color:#e11d48;text-decoration:none;">Tools</a> &rsaquo; ${escapeHtml(toolName)}</nav>`,
    `<h1 style="margin-bottom:8px;">${escapeHtml(toolName)}</h1>`,
    `<p style="color:#444;margin-bottom:16px;">${escapeHtml(metaDesc)}</p>`,
    `<p style="color:#555;font-size:0.93rem;margin-bottom:16px;">VinzaTools is a free online tools platform with 94+ tools for PDF editing, image processing, video downloading, and more. This tool — <strong>${escapeHtml(toolName)}</strong> — is completely free to use, requires no account, and delivers instant results directly in your browser.</p>`,
    `<h2 style="font-size:1.1rem;margin-bottom:8px;">How to use ${escapeHtml(toolName)}</h2>`,
    `<p style="color:#444;margin-bottom:16px;">${escapeHtml(howToUse)}</p>`,
    `<h2 style="font-size:1.1rem;margin-bottom:8px;">Key features</h2>`,
    featureBulletsHtml,
    `<h2 style="font-size:1.1rem;margin-bottom:8px;">Why use VinzaTools?</h2>`,
    `<p style="color:#444;margin-bottom:16px;">VinzaTools offers 94+ free online tools with no signup, no watermarks, and no hidden fees. Every tool works directly in your browser — no software to install, no file uploads to third-party servers. Whether you need to edit a PDF, compress an image, or download a video, VinzaTools has a fast and free solution.</p>`,
    `<p><strong>Open this tool:</strong> <a href="${canonical}" style="color:#e11d48;">${canonical}</a></p>`,
    relatedLinksHtml,
    `<p style="margin-top:16px;"><a href="${SITE}/tools" style="color:#e11d48;">Browse all 94+ free tools on VinzaTools &rarr;</a></p>`,
    `</main>`,
    `</noscript>`,
  ].join('\n');
  html = html.replace('<body>', `<body>\n${noscript}\n`);

  return html;
};

const toolsRoot = path.join(distDir, 'tools');
fs.mkdirSync(toolsRoot, { recursive: true });

for (const tool of INTERNAL_TOOLS) {
  const outDir = path.join(toolsRoot, tool.id);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'index.html');
  const relatedTools = INTERNAL_TOOLS
    .filter(t => t.category === tool.category && t.id !== tool.id)
    .slice(0, 6)
    .map(t => ({ id: t.id, name: t.name }));
  fs.writeFileSync(outPath, buildToolPage(tool.id, tool.name, tool.description, tool.category, relatedTools), 'utf8');
}

console.log(`Generated ${INTERNAL_TOOLS.length} tool landing pages into dist/tools/<id>/index.html`);
