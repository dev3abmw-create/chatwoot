#!/usr/bin/env bun

import path from 'path';
import { readFile } from 'fs/promises';

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = 'public';
const PROXY_TARGET = 'https://app.chatwoot.com';
const MANIFEST_PATH = '../public/vite/.vite/manifest.json';
const WEBSITE_TOKEN = 'WkavhKXYD6cG6rinFyuAxDt7';

const widgetHTMLTemplate = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Chatwoot</title>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      <!-- CSS_PLACEHOLDER -->
      <script>
        window.chatwootWebChannel = <!-- CONFIG_PLACEHOLDER -->;
        window.chatwootPubsubToken = <!-- PUBSUB_TOKEN_PLACEHOLDER -->;
        window.authToken = <!-- AUTH_TOKEN_PLACEHOLDER -->;
        window.globalConfig = <!-- GLOBAL_CONFIG_PLACEHOLDER -->;
      </script>
    </head>
    <body>
      <div id="app" class="h-full"></div>
      <script type="module" src="<!-- JS_PLACEHOLDER -->"></script>
    </body>
  </html>`;

async function getWidgetHTML(authToken) {
  const response = await fetch(`${PROXY_TARGET}/api/v1/widget/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': authToken },
    body: JSON.stringify({ website_token: WEBSITE_TOKEN})
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch config: ${response.status}`);
  }

  const data = await response.json();
  const config = data.website_channel_config;
  const contact = data.contact;

  // Read manifest
  const manifestResolvedPath = path.resolve(path.dirname(__filename), MANIFEST_PATH);
  if (!(await Bun.file(manifestResolvedPath).exists())) {
    throw new Error('Manifest not found. Please run: pnpm exec vite build');
  }

  const manifest = JSON.parse(await readFile(manifestResolvedPath, 'utf-8'));
  const widgetEntry = manifest['entrypoints/widget.js'];

  if (!widgetEntry) {
    throw new Error('Widget entry not found in manifest');
  }

  const widgetJS = `/vite/${widgetEntry.file}`;
  const widgetCSS = widgetEntry.css ? `/vite/${widgetEntry.css[0]}` : '';

  let html = widgetHTMLTemplate;

  // Build config object
  const chatwootWebChannel = {
    avatarUrl: config.avatar_url,
    hasAConnectedAgentBot: config.has_a_connected_agent_bot || '',
    locale: config.locale,
    websiteName: config.website_name,
    websiteToken: config.website_token,
    welcomeTagline: config.welcome_tagline,
    welcomeTitle: config.welcome_title,
    widgetColor: config.widget_color,
    portal: config.portal,
    enabledFeatures: config.enabled_features,
    enabledLanguages: config.enabled_languages,
    replyTime: config.reply_time,
    preChatFormEnabled: config.pre_chat_form_enabled,
    preChatFormOptions: config.pre_chat_form_options,
    workingHoursEnabled: config.working_hours_enabled,
    csatSurveyEnabled: config.csat_survey_enabled,
    workingHours: config.working_hours,
    outOfOfficeMessage: config.out_of_office_message,
    utcOffset: config.utc_off_set,
    timezone: config.timezone,
    allowMessagesAfterResolved: config.allow_messages_after_resolved,
    disableBranding: true,
  };

  // Replace placeholders
  html = html.replace('<!-- CSS_PLACEHOLDER -->', widgetCSS ? `<link rel="stylesheet" href="${widgetCSS}">` : '');
  html = html.replace('<!-- JS_PLACEHOLDER -->', widgetJS);
  html = html.replace('<!-- CONFIG_PLACEHOLDER -->', JSON.stringify(chatwootWebChannel));
  html = html.replace('<!-- PUBSUB_TOKEN_PLACEHOLDER -->', JSON.stringify(contact.pubsub_token));
  html = html.replace('<!-- AUTH_TOKEN_PLACEHOLDER -->', JSON.stringify(authToken || config.auth_token));
  html = html.replace('<!-- GLOBAL_CONFIG_PLACEHOLDER -->', JSON.stringify(data.global_config));

  return html;
}

function getContentType(pathname) {
  const ext = pathname.split('.').pop()?.toLowerCase();
  const types = {
    html: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    xml: 'application/xml',
    txt: 'text/plain',
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    webm: 'video/webm',
    pdf: 'application/pdf'
  };
  return types[ext] || 'application/octet-stream';
}


let lastRenderedHTMLTimestamp = null;
let lastRenderedHTML = null;
const MAX_HTML_CACHE_AGE = 1000 * 60 * 10; // 10 minutes

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    // Proxy API and auth requests to app.chatwoot.com
    if (pathname.startsWith('/api/') || pathname.startsWith('/auth/')) {
      try {
        const proxyUrl = `${PROXY_TARGET}${pathname}${url.search}`;
        const headers = new Headers(req.headers);
        headers.delete('host');

        const proxyReq = await fetch(proxyUrl, {
          method: req.method,
          headers: headers,
          body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.blob() : undefined,
        });

        return new Response(proxyReq.body, {
          status: proxyReq.status,
          headers: proxyReq.headers,
        });
      } catch (error) {
        console.error('Proxy error:', error);
        return new Response('Proxy Error', { status: 502 });
      }
    }

    // Serve widget.html for /widget requests
    else if (pathname === '/widget') {
      const authToken = url.searchParams.get('cw_conversation');

      if(lastRenderedHTMLTimestamp && Date.now() - lastRenderedHTMLTimestamp < MAX_HTML_CACHE_AGE) {
        return new Response(lastRenderedHTML, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
          },
        });
      }
      const html = await getWidgetHTML(authToken);
      lastRenderedHTMLTimestamp = Date.now();
      lastRenderedHTML = html;
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }


    else {
      const filePath = path.join(PUBLIC_DIR, pathname);
      
      if(!filePath.startsWith(PUBLIC_DIR + path.sep) ) {
        return new Response('Not Found', { status: 404 });
      }

      try {
        const file = Bun.file(filePath);

        // Check if file exists
        if (await file.exists()) {
          return new Response(file, {
            headers: {
              'Content-Type': getContentType(pathname),
              'Cache-Control': pathname.match(/\.(js|css|png|jpg|svg)$/) 
                ? 'public, max-age=31536000' 
                : 'no-cache',
            },
          });
        }
      } catch (error) {
        console.error('Error:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Server running at http://localhost:${PORT}`);

