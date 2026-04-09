import crypto from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function parseCookies(request) {
  const header = request.headers.cookie;
  if (!header) {
    return {};
  }

  return header.split(';').reduce((cookies, part) => {
    const [rawName, ...rest] = part.trim().split('=');
    cookies[rawName] = decodeURIComponent(rest.join('='));
    return cookies;
  }, {});
}

function appendCookie(response, cookie) {
  const current = response.getHeader('Set-Cookie');
  if (!current) {
    response.setHeader('Set-Cookie', [cookie]);
    return;
  }

  if (Array.isArray(current)) {
    response.setHeader('Set-Cookie', [...current, cookie]);
    return;
  }

  response.setHeader('Set-Cookie', [current, cookie]);
}

export function setCookie(response, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  if (options.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options.secure) {
    parts.push('Secure');
  }

  appendCookie(response, parts.join('; '));
}

export function clearCookie(response, name, options = {}) {
  setCookie(response, name, '', {
    ...options,
    maxAge: 0,
  });
}

function encodeSignedPayload(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded, secret)}`;
}

function decodeSignedPayload(value, secret) {
  if (!value || !value.includes('.')) {
    return null;
  }

  const [encoded, signature] = value.split('.');
  if (signature !== sign(encoded, secret)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function readSession(request, config) {
  const cookies = parseCookies(request);
  return decodeSignedPayload(cookies.app_session, config.sessionSecret);
}

export function writeSession(response, config, session) {
  setCookie(response, 'app_session', encodeSignedPayload(session, config.sessionSecret), {
    path: '/',
    sameSite: 'Lax',
    secure: config.cookieSecure,
    maxAge: 60 * 60 * 8,
  });
}

export function clearSession(response, config) {
  clearCookie(response, 'app_session', {
    path: '/',
    sameSite: 'Lax',
    secure: config.cookieSecure,
  });
}

export function readFlash(request, config) {
  const cookies = parseCookies(request);
  return decodeSignedPayload(cookies.app_flash, config.sessionSecret);
}

export function writeFlash(response, config, flash) {
  setCookie(response, 'app_flash', encodeSignedPayload(flash, config.sessionSecret), {
    path: '/',
    sameSite: 'Lax',
    secure: config.cookieSecure,
    maxAge: 60,
  });
}

export function clearFlash(response, config) {
  clearCookie(response, 'app_flash', {
    path: '/',
    sameSite: 'Lax',
    secure: config.cookieSecure,
  });
}

export function isAuthenticated(session, config) {
  return Boolean(session?.username && session.username === config.adminUsername);
}

export async function parseFormBody(request) {
  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder('utf8');
    let body = '';

    request.on('data', (chunk) => {
      body += decoder.write(chunk);
      if (body.length > 1_000_000) {
        reject(new Error('Body request terlalu besar.'));
      }
    });
    request.on('end', () => {
      body += decoder.end();
      resolve(Object.fromEntries(new URLSearchParams(body).entries()));
    });
    request.on('error', reject);
  });
}

export function applySecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; form-action 'self'; base-uri 'self'; img-src 'self' data:;",
  );
}

export function sendHtml(response, statusCode, html) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(html);
}

export function sendJson(response, statusCode, data) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(data));
}

export function sendPdf(response, fileName, pdfBuffer) {
  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  response.end(pdfBuffer);
}

export function redirect(response, location, statusCode = 303) {
  response.statusCode = statusCode;
  response.setHeader('Location', location);
  response.end();
}

export function notFound(response) {
  sendHtml(
    response,
    404,
    '<!doctype html><html><body><h1>404</h1><p>Halaman tidak ditemukan.</p></body></html>',
  );
}
