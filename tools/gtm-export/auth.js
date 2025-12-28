/**
 * GTM Export - OAuth2 Authentication Setup
 *
 * 3가지 인증 방식 지원:
 *   1. gcloud CLI (권장) - gcloud auth application-default login
 *   2. credentials.json - Google Cloud Console에서 다운로드
 *   3. 환경변수 - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *
 * Usage:
 *   npm run auth
 */

import { google } from 'googleapis';
import http from 'http';
import { URL } from 'url';
import open from 'open';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/tagmanager.readonly',
  'https://www.googleapis.com/auth/tagmanager.edit.containers'
];

/**
 * gcloud CLI 설치 확인
 */
function checkGcloudInstalled() {
  try {
    execSync('which gcloud', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * gcloud ADC(Application Default Credentials) 확인
 */
function checkADC() {
  const adcPath = path.join(
    process.env.HOME || process.env.USERPROFILE,
    '.config/gcloud/application_default_credentials.json'
  );
  return fs.existsSync(adcPath);
}

/**
 * gcloud를 통한 인증 (ADC 방식)
 */
async function authenticateWithGcloud() {
  console.log('\n🔐 gcloud CLI를 통한 인증을 시작합니다...\n');

  if (!checkGcloudInstalled()) {
    console.log('gcloud CLI가 설치되어 있지 않습니다.');
    console.log('\n📥 설치 방법:');
    console.log('   brew install google-cloud-sdk');
    console.log('   또는 https://cloud.google.com/sdk/docs/install 참조\n');
    return null;
  }

  // ADC가 이미 있는지 확인
  if (checkADC()) {
    console.log('✅ 기존 gcloud 인증 정보를 사용합니다.\n');
    return google.auth.getClient({ scopes: SCOPES });
  }

  // ADC 로그인 실행
  console.log('브라우저에서 Google 로그인을 진행합니다...\n');
  console.log('다음 명령어를 실행하세요:');
  console.log('─'.repeat(50));
  console.log('gcloud auth application-default login \\');
  console.log('  --scopes=https://www.googleapis.com/auth/tagmanager.readonly,https://www.googleapis.com/auth/tagmanager.edit.containers');
  console.log('─'.repeat(50));

  // 자동 실행 시도
  try {
    console.log('\n자동으로 인증을 시작합니다...\n');
    execSync(
      `gcloud auth application-default login --scopes=${SCOPES.join(',')}`,
      { stdio: 'inherit' }
    );
    console.log('\n✅ 인증 완료!\n');
    return google.auth.getClient({ scopes: SCOPES });
  } catch (err) {
    console.error('자동 인증 실패. 위 명령어를 수동으로 실행하세요.');
    return null;
  }
}

/**
 * credentials.json을 통한 인증 (OAuth2 Client 방식)
 */
async function authenticateWithCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }

  console.log('\n🔐 credentials.json을 통한 인증을 시작합니다...\n');

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_id, client_secret } = credentials.installed || credentials.web;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    'http://localhost:3000/callback'
  );

  // 기존 토큰 확인
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oauth2Client.setCredentials(token);

    if (token.expiry_date && token.expiry_date > Date.now()) {
      console.log('✅ 기존 토큰이 유효합니다.\n');
      return oauth2Client;
    }

    // 토큰 갱신 시도
    try {
      const { credentials: newToken } = await oauth2Client.refreshAccessToken();
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(newToken, null, 2));
      console.log('✅ 토큰이 갱신되었습니다.\n');
      return oauth2Client;
    } catch {
      console.log('토큰 갱신 실패. 재인증이 필요합니다.\n');
    }
  }

  // 새로운 인증 진행
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost:3000');

        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');

          if (code) {
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                  <h1>✅ 인증 완료!</h1>
                  <p>이 창을 닫고 터미널로 돌아가세요.</p>
                </body>
              </html>
            `);

            server.close();
            console.log('✅ 인증 성공! token.json이 저장되었습니다.\n');
            resolve(oauth2Client);
          }
        }
      } catch (err) {
        res.writeHead(500);
        res.end('Authentication failed');
        reject(err);
      }
    });

    server.listen(3000, async () => {
      console.log('콜백 서버 시작: http://localhost:3000');
      console.log('브라우저에서 Google 로그인을 진행합니다...\n');
      await open(authUrl);
    });
  });
}

/**
 * 환경변수를 통한 인증
 */
async function authenticateWithEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  console.log('\n🔐 환경변수를 통한 인증을 시작합니다...\n');

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'http://localhost:3000/callback'
  );

  // 기존 토큰 확인
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oauth2Client.setCredentials(token);

    if (token.expiry_date && token.expiry_date > Date.now()) {
      console.log('✅ 기존 토큰이 유효합니다.\n');
      return oauth2Client;
    }
  }

  // 새로운 인증 진행
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost:3000');

        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');

          if (code) {
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                  <h1>✅ 인증 완료!</h1>
                  <p>이 창을 닫고 터미널로 돌아가세요.</p>
                </body>
              </html>
            `);

            server.close();
            console.log('✅ 인증 성공! token.json이 저장되었습니다.\n');
            resolve(oauth2Client);
          }
        }
      } catch (err) {
        res.writeHead(500);
        res.end('Authentication failed');
        reject(err);
      }
    });

    server.listen(3000, async () => {
      console.log('콜백 서버 시작: http://localhost:3000');
      console.log('브라우저에서 Google 로그인을 진행합니다...\n');
      await open(authUrl);
    });
  });
}

/**
 * 메인 인증 함수 - 여러 방식 순차 시도
 */
async function authenticate() {
  console.log('='.repeat(50));
  console.log('  GTM Export - OAuth2 인증');
  console.log('='.repeat(50));

  let auth = null;

  // 1. credentials.json 확인
  if (fs.existsSync(CREDENTIALS_PATH)) {
    auth = await authenticateWithCredentials();
    if (auth) return auth;
  }

  // 2. 환경변수 확인
  if (process.env.GOOGLE_CLIENT_ID) {
    auth = await authenticateWithEnv();
    if (auth) return auth;
  }

  // 3. gcloud CLI 사용
  auth = await authenticateWithGcloud();
  if (auth) return auth;

  // 모든 방법 실패
  console.error(`
${'='.repeat(50)}
  인증 방법을 선택하세요:
${'='.repeat(50)}

📌 방법 1: gcloud CLI (권장)
   brew install google-cloud-sdk
   gcloud auth application-default login

📌 방법 2: credentials.json
   1. https://console.cloud.google.com/apis/credentials 접속
   2. OAuth 2.0 클라이언트 ID 생성 (Desktop app)
   3. JSON 다운로드 → ${CREDENTIALS_PATH}

📌 방법 3: 환경변수
   export GOOGLE_CLIENT_ID="your-client-id"
   export GOOGLE_CLIENT_SECRET="your-client-secret"

${'='.repeat(50)}
`);
  process.exit(1);
}

// 실행
authenticate()
  .then(() => {
    console.log('인증 완료. 이제 npm run export 를 실행하세요.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('인증 실패:', err.message);
    process.exit(1);
  });
