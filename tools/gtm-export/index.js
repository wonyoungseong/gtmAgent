/**
 * GTM Export - Full Container Export CLI
 *
 * GTM API를 직접 호출하여 전체 컨테이너 데이터를 JSON으로 내보냅니다.
 * MCP 서버의 페이지네이션 제한 없이 완전한 데이터를 가져옵니다.
 *
 * Usage:
 *   npm run export                    # Interactive mode
 *   npm run export -- --live          # Export live version
 *   npm run export -- --version 27    # Export specific version
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const EXPORTS_DIR = path.join(__dirname, '../../exports');

// Ensure exports directory exists
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

const SCOPES = [
  'https://www.googleapis.com/auth/tagmanager.readonly',
  'https://www.googleapis.com/auth/tagmanager.edit.containers'
];

/**
 * ADC(Application Default Credentials) 확인
 */
function checkADC() {
  const adcPath = path.join(
    process.env.HOME || process.env.USERPROFILE,
    '.config/gcloud/application_default_credentials.json'
  );
  return fs.existsSync(adcPath);
}

/**
 * OAuth2 클라이언트 생성 및 인증 (다중 방식 지원)
 */
async function getAuthenticatedClient() {
  // 1. credentials.json + token.json 방식
  if (fs.existsSync(CREDENTIALS_PATH) && fs.existsSync(TOKEN_PATH)) {
    console.log('credentials.json 인증 사용');
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));

    const { client_id, client_secret } = credentials.installed || credentials.web;

    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      'http://localhost:3000/callback'
    );

    oauth2Client.setCredentials(token);

    // 토큰 만료 확인 및 갱신
    if (token.expiry_date && token.expiry_date < Date.now()) {
      console.log('토큰 갱신 중...');
      try {
        const { credentials: newToken } = await oauth2Client.refreshAccessToken();
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(newToken, null, 2));
        oauth2Client.setCredentials(newToken);
        console.log('토큰 갱신 완료');
      } catch (err) {
        console.error('토큰 갱신 실패. npm run auth를 다시 실행하세요.');
        process.exit(1);
      }
    }

    return oauth2Client;
  }

  // 2. 환경변수 + token.json 방식
  if (process.env.GOOGLE_CLIENT_ID && fs.existsSync(TOKEN_PATH)) {
    console.log('환경변수 인증 사용');
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3000/callback'
    );

    oauth2Client.setCredentials(token);
    return oauth2Client;
  }

  // 3. gcloud ADC 방식
  if (checkADC()) {
    console.log('gcloud ADC 인증 사용');
    return google.auth.getClient({ scopes: SCOPES });
  }

  // 인증 없음
  console.error(`
인증이 필요합니다. 다음 중 하나를 실행하세요:

1. gcloud CLI (권장):
   brew install google-cloud-sdk
   gcloud auth application-default login --scopes=${SCOPES.join(',')}

2. credentials.json:
   npm run auth

3. 환경변수:
   export GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..."
   npm run auth
`);
  process.exit(1);
}

/**
 * GTM 계정 목록 조회
 */
async function listAccounts(tagmanager) {
  const response = await tagmanager.accounts.list();
  return response.data.account || [];
}

/**
 * GTM 컨테이너 목록 조회
 */
async function listContainers(tagmanager, accountId) {
  const response = await tagmanager.accounts.containers.list({
    parent: `accounts/${accountId}`
  });
  return response.data.container || [];
}

/**
 * Live 버전 내보내기 (현재 배포된 버전)
 */
async function exportLiveVersion(tagmanager, accountId, containerId) {
  console.log(`\nLive 버전 조회 중... (Account: ${accountId}, Container: ${containerId})`);

  const response = await tagmanager.accounts.containers.versions.live({
    parent: `accounts/${accountId}/containers/${containerId}`
  });

  return response.data;
}

/**
 * 특정 버전 내보내기
 */
async function exportVersion(tagmanager, accountId, containerId, versionId) {
  console.log(`\n버전 ${versionId} 조회 중... (Account: ${accountId}, Container: ${containerId})`);

  const response = await tagmanager.accounts.containers.versions.get({
    path: `accounts/${accountId}/containers/${containerId}/versions/${versionId}`
  });

  return response.data;
}

/**
 * 버전 헤더 목록 조회 (버전 선택용)
 */
async function listVersionHeaders(tagmanager, accountId, containerId) {
  const response = await tagmanager.accounts.containers.version_headers.list({
    parent: `accounts/${accountId}/containers/${containerId}`
  });
  return response.data.containerVersionHeader || [];
}

/**
 * 내보내기 결과 저장
 */
function saveExport(data, filename) {
  const filepath = path.join(EXPORTS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\n✅ 내보내기 완료: ${filepath}`);

  // 요약 정보 출력
  console.log('\n📊 내보내기 요약:');
  console.log(`   - 컨테이너: ${data.container?.name || 'N/A'}`);
  console.log(`   - 버전 ID: ${data.containerVersionId || 'N/A'}`);
  console.log(`   - 버전 이름: ${data.name || 'N/A'}`);
  console.log(`   - 태그: ${data.tag?.length || 0}개`);
  console.log(`   - 트리거: ${data.trigger?.length || 0}개`);
  console.log(`   - 변수: ${data.variable?.length || 0}개`);
  console.log(`   - 폴더: ${data.folder?.length || 0}개`);
  console.log(`   - 내장 변수: ${data.builtInVariable?.length || 0}개`);
  console.log(`   - 커스텀 템플릿: ${data.customTemplate?.length || 0}개`);

  return filepath;
}

/**
 * 인터랙티브 모드 (readline 사용)
 */
async function interactiveMode(tagmanager) {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise((resolve) => {
    rl.question(prompt, resolve);
  });

  try {
    // 1. 계정 선택
    console.log('\n📋 GTM 계정 목록:');
    const accounts = await listAccounts(tagmanager);

    if (accounts.length === 0) {
      console.log('접근 가능한 계정이 없습니다.');
      rl.close();
      return;
    }

    accounts.forEach((acc, i) => {
      console.log(`   ${i + 1}. ${acc.name} (ID: ${acc.accountId})`);
    });

    const accIndex = parseInt(await question('\n계정 번호 선택: ')) - 1;
    const selectedAccount = accounts[accIndex];

    if (!selectedAccount) {
      console.log('잘못된 선택입니다.');
      rl.close();
      return;
    }

    // 2. 컨테이너 선택
    console.log('\n📦 컨테이너 목록:');
    const containers = await listContainers(tagmanager, selectedAccount.accountId);

    if (containers.length === 0) {
      console.log('컨테이너가 없습니다.');
      rl.close();
      return;
    }

    containers.forEach((cont, i) => {
      console.log(`   ${i + 1}. ${cont.name} (ID: ${cont.containerId})`);
    });

    const contIndex = parseInt(await question('\n컨테이너 번호 선택: ')) - 1;
    const selectedContainer = containers[contIndex];

    if (!selectedContainer) {
      console.log('잘못된 선택입니다.');
      rl.close();
      return;
    }

    // 3. 버전 선택
    console.log('\n🔖 내보내기 옵션:');
    console.log('   1. Live 버전 (현재 배포된 버전)');
    console.log('   2. 특정 버전 선택');

    const versionChoice = await question('\n옵션 선택: ');

    let exportData;
    let filename;

    if (versionChoice === '1') {
      exportData = await exportLiveVersion(
        tagmanager,
        selectedAccount.accountId,
        selectedContainer.containerId
      );
      filename = `${selectedContainer.name.replace(/[^a-zA-Z0-9]/g, '_')}_live_${Date.now()}.json`;
    } else {
      // 버전 목록 표시
      console.log('\n📜 버전 목록:');
      const versions = await listVersionHeaders(
        tagmanager,
        selectedAccount.accountId,
        selectedContainer.containerId
      );

      if (versions.length === 0) {
        console.log('버전이 없습니다.');
        rl.close();
        return;
      }

      versions.slice(0, 10).forEach((ver, i) => {
        console.log(`   ${i + 1}. v${ver.containerVersionId}: ${ver.name || '(이름 없음)'}`);
      });

      const verIndex = parseInt(await question('\n버전 번호 선택: ')) - 1;
      const selectedVersion = versions[verIndex];

      if (!selectedVersion) {
        console.log('잘못된 선택입니다.');
        rl.close();
        return;
      }

      exportData = await exportVersion(
        tagmanager,
        selectedAccount.accountId,
        selectedContainer.containerId,
        selectedVersion.containerVersionId
      );
      filename = `${selectedContainer.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${selectedVersion.containerVersionId}_${Date.now()}.json`;
    }

    saveExport(exportData, filename);
    rl.close();

  } catch (err) {
    console.error('오류 발생:', err.message);
    rl.close();
    process.exit(1);
  }
}

/**
 * CLI 모드 (인자로 직접 지정)
 */
async function cliMode(tagmanager, args) {
  const accountId = args.account || process.env.GTM_ACCOUNT_ID;
  const containerId = args.container || process.env.GTM_CONTAINER_ID;

  if (!accountId || !containerId) {
    console.log('계정 ID와 컨테이너 ID가 필요합니다.');
    console.log('사용법: npm run export -- --account <ID> --container <ID> [--live | --version <ID>]');
    console.log('또는 환경 변수 설정: GTM_ACCOUNT_ID, GTM_CONTAINER_ID');
    process.exit(1);
  }

  let exportData;
  let filename;
  const containerName = `container_${containerId}`;

  if (args.live) {
    exportData = await exportLiveVersion(tagmanager, accountId, containerId);
    filename = `${containerName}_live_${Date.now()}.json`;
  } else if (args.version) {
    exportData = await exportVersion(tagmanager, accountId, containerId, args.version);
    filename = `${containerName}_v${args.version}_${Date.now()}.json`;
  } else {
    // 기본: live 버전
    exportData = await exportLiveVersion(tagmanager, accountId, containerId);
    filename = `${containerName}_live_${Date.now()}.json`;
  }

  saveExport(exportData, filename);
}

/**
 * 인자 파싱
 */
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--live') {
      args.live = true;
    } else if (arg === '--version' && argv[i + 1]) {
      args.version = argv[++i];
    } else if (arg === '--account' && argv[i + 1]) {
      args.account = argv[++i];
    } else if (arg === '--container' && argv[i + 1]) {
      args.container = argv[++i];
    }
  }
  return args;
}

/**
 * 메인 실행
 */
async function main() {
  console.log('='.repeat(50));
  console.log('  GTM Container Export Tool');
  console.log('  Full JSON export via Google Tag Manager API');
  console.log('='.repeat(50));

  try {
    const auth = await getAuthenticatedClient();
    const tagmanager = google.tagmanager({ version: 'v2', auth });

    const args = parseArgs(process.argv);

    // CLI 인자가 있으면 CLI 모드, 없으면 인터랙티브 모드
    if (args.account || args.container || args.live || args.version) {
      await cliMode(tagmanager, args);
    } else {
      await interactiveMode(tagmanager);
    }

  } catch (err) {
    console.error('\n❌ 오류:', err.message);
    if (err.code === 401) {
      console.log('인증이 만료되었습니다. npm run auth를 실행하세요.');
    }
    process.exit(1);
  }
}

main();
