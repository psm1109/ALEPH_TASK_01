import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { getRegistrationAccess } from '../api/_lib/registration-access.js';
import privateItemsHandler from '../api/private-items.js';
import registerOptionsHandler from '../api/passkey/register-options.js';
import credentialsHandler from '../api/passkey/credentials.js';
import { describePasskeyLocation } from '../api/_lib/passkey-metadata.js';
import { normalizePasskeyName } from '../api/_lib/passkey-name.js';
import { describePasskeyClientError, shouldStartPasskeyRegistration } from '../passkey-client.js';
import { clearSessionCookie, createSession, hasValidSession, revokeSession } from '../api/_lib/session.js';

const PRIVATE_MARKERS = [
  '준비 중인 프로젝트 메모',
  '지원하려는 곳 목록',
  '스스로 쓰는 회고',
];

function createResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    end(value = '') {
      this.body = value;
    },
  };
}

test('비인증 비공개 자료 요청은 DB 환경변수 없이도 401로 거절한다', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalSessionSecret = process.env.SESSION_SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.SESSION_SECRET;

  const request = { method: 'GET', headers: {} };
  const response = createResponse();
  await privateItemsHandler(request, response);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(JSON.parse(response.body), { error: '패스키 인증이 필요합니다.' });
  assert.equal(response.getHeader('cache-control'), 'no-store, max-age=0');

  if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalSessionSecret) process.env.SESSION_SECRET = originalSessionSecret;
});

test('권한 없는 패스키 등록 요청은 DB 접속 전에 403으로 거절한다', async () => {
  const request = { method: 'POST', headers: {} };
  const response = createResponse();
  await registerOptionsHandler(request, response);

  assert.equal(response.statusCode, 403);
  assert.deepEqual(JSON.parse(response.body), { error: '패스키 등록 권한이 없습니다.' });
});

test('세션 비밀값이 없으면 credential 생성 전에 503으로 중단한다', async () => {
  const originalSetupSecret = process.env.PASSKEY_SETUP_SECRET;
  const originalSessionSecret = process.env.SESSION_SECRET;
  const setupSecret = 'test-only-bootstrap-secret-value-1234567890';
  process.env.PASSKEY_SETUP_SECRET = setupSecret;
  delete process.env.SESSION_SECRET;

  try {
    const request = {
      method: 'POST',
      headers: { 'x-passkey-setup-secret': setupSecret },
    };
    const response = createResponse();
    await registerOptionsHandler(request, response);

    assert.equal(response.statusCode, 503);
    assert.deepEqual(JSON.parse(response.body), { error: '서버 세션 설정이 완료되지 않았습니다.' });
  } finally {
    if (originalSetupSecret === undefined) delete process.env.PASSKEY_SETUP_SECRET;
    else process.env.PASSKEY_SETUP_SECRET = originalSetupSecret;
    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
  }
});

test('비인증 페이지 응답용 빌드 결과에 비공개 항목 내용이 포함되지 않는다', async () => {
  const index = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const assetsDirectory = new URL('../dist/assets/', import.meta.url);
  const assetNames = await readdir(assetsDirectory);
  const javascript = await Promise.all(
    assetNames
      .filter((name) => name.endsWith('.js'))
      .map((name) => readFile(new URL(name, assetsDirectory), 'utf8')),
  );
  const publicResponseSource = [index, ...javascript].join('\n');

  for (const marker of PRIVATE_MARKERS) {
    assert.equal(publicResponseSource.includes(marker), false, `${marker} 문구가 공개 빌드에 없어야 합니다.`);
  }
});

test('패스키 자료는 기존 계정 자료와 분리된 전용 테이블에서만 읽는다', async () => {
  const handlerSource = await readFile(new URL('../api/private-items.js', import.meta.url), 'utf8');
  const schemaSource = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');

  assert.equal(handlerSource.includes('FROM passkey_private_items'), true);
  assert.equal(handlerSource.includes('FROM private_items'), false);
  assert.equal(schemaSource.includes('CREATE TABLE IF NOT EXISTS passkey_private_items'), true);
});

test('공개 잠금 패널에는 별도 등록 버튼을 노출하지 않고 같은 페이지 등록 대화상자를 둔다', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const setupSource = await readFile(new URL('../setup/index.html', import.meta.url), 'utf8');
  const privateSection = source.match(/<section class="private-section[\s\S]*?<\/section>/)?.[0];

  assert.ok(privateSection, '비공개 잠금 영역을 찾을 수 있어야 합니다.');
  assert.equal(privateSection.includes('일회용 설정 코드'), false);
  assert.equal(privateSection.includes('data-first-passkey-setup'), false);
  assert.equal(privateSection.includes('href="/setup"'), false);
  assert.equal(source.includes('data-passkey-bootstrap-dialog'), true);
  assert.equal(source.includes('data-passkey-bootstrap-code'), true);
  assert.equal(source.includes('data-passkey-manage'), true);
  assert.equal(source.includes('data-passkey-manage-dialog'), true);
  assert.equal(setupSource.includes('data-setup-code'), true);
  assert.equal(setupSource.includes('일회용 설정 코드'), true);
});

test('비공개 API와 인증 응답은 캐시되지 않도록 설정한다', async () => {
  const request = { method: 'POST', headers: {} };
  const response = createResponse();
  await registerOptionsHandler(request, response);
  assert.equal(response.getHeader('cache-control'), 'no-store, max-age=0');
});

test('최초 등록 코드는 credential이 생긴 뒤 재사용할 수 없다', () => {
  assert.deepEqual(
    getRegistrationAccess({ sessionAuthorized: false, setupAuthorized: true, hasCredential: false }),
    { allowed: true, bootstrap: true },
  );
  assert.deepEqual(
    getRegistrationAccess({ sessionAuthorized: false, setupAuthorized: true, hasCredential: true }),
    { allowed: false, status: 409, error: '최초 패스키 설정은 이미 완료되었습니다.' },
  );
});

test('추가 패스키는 인증된 세션에서만 등록할 수 있다', () => {
  assert.deepEqual(
    getRegistrationAccess({ sessionAuthorized: true, setupAuthorized: false, hasCredential: true }),
    { allowed: true, bootstrap: false },
  );
  assert.deepEqual(
    getRegistrationAccess({ sessionAuthorized: false, setupAuthorized: false, hasCredential: true }),
    { allowed: false, status: 403, error: '패스키 등록 권한이 없습니다.' },
  );
});

test('패스키가 없을 때 열기 동작은 같은 페이지 등록 ceremony를 시작한다', () => {
  assert.equal(shouldStartPasskeyRegistration(true), true);
  assert.equal(shouldStartPasskeyRegistration(false), false);
});

test('패스키 UI는 추가 capability가 아닌 WebAuthn API 지원 여부로 활성화한다', async () => {
  const mainSource = await readFile(new URL('../script.js', import.meta.url), 'utf8');
  const setupSource = await readFile(new URL('../setup.js', import.meta.url), 'utf8');

  for (const source of [mainSource, setupSource]) {
    assert.equal(source.includes('browserSupportsWebAuthn'), true);
    assert.equal(source.includes('browserSupportsPasskeys'), false);
  }
});

test('패스키 등록 취소는 저장되지 않았다는 한국어 안내를 반환한다', async () => {
  const message = describePasskeyClientError({ name: 'NotAllowedError' }, true);
  const clientSource = await readFile(new URL('../passkey-client.js', import.meta.url), 'utf8');
  const challengeSource = await readFile(new URL('../api/_lib/challenges.js', import.meta.url), 'utf8');

  assert.equal(message.includes('서버에는 패스키가 저장되지 않았습니다.'), true);
  assert.equal(clientSource.includes('/api/passkey/challenge-cancel'), true);
  assert.equal(challengeSource.includes('DELETE FROM webauthn_challenges'), true);
});

test('패스키 인증은 저장 당시 transport로 인증 기기를 제한하지 않는다', async () => {
  const source = await readFile(new URL('../api/passkey/authenticate-options.js', import.meta.url), 'utf8');

  assert.equal(source.includes('allowCredentials'), false);
  assert.equal(source.includes("userVerification: 'required'"), true);
});

test('비인증 사용자는 패스키 목록을 조회할 수 없다', async () => {
  const request = { method: 'GET', headers: {} };
  const response = createResponse();
  await credentialsHandler(request, response);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(JSON.parse(response.body), { error: '패스키 인증이 필요합니다.' });
});

test('패스키 저장 위치는 인증 transport와 백업 상태로 설명한다', () => {
  assert.equal(
    describePasskeyLocation({ transports: ['internal'], deviceType: 'singleDevice', backedUp: false }),
    '이 기기의 Windows Hello 또는 기기 잠금',
  );
  assert.equal(
    describePasskeyLocation({ transports: ['internal', 'hybrid'], deviceType: 'multiDevice', backedUp: true }),
    '휴대폰 또는 동기화된 패스키 관리자',
  );
  assert.equal(
    describePasskeyLocation({ transports: ['usb'], deviceType: 'singleDevice', backedUp: false }),
    '외장 보안 키',
  );
});

test('패스키 이름은 공백을 정리한 1~40자만 저장한다', () => {
  assert.equal(normalizePasskeyName('  회사 노트북   Windows Hello  '), '회사 노트북 Windows Hello');
  assert.equal(normalizePasskeyName(''), null);
  assert.equal(normalizePasskeyName('가'.repeat(41)), null);
});

test('패스키 등록과 목록 API는 사람이 알아볼 수 있는 이름을 저장하고 반환한다', async () => {
  const registerSource = await readFile(new URL('../api/passkey/register-verify.js', import.meta.url), 'utf8');
  const credentialsSource = await readFile(new URL('../api/passkey/credentials.js', import.meta.url), 'utf8');
  const schemaSource = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');

  assert.equal(registerSource.includes('display_name'), true);
  assert.equal(registerSource.includes('${passkeyName}'), true);
  assert.equal(credentialsSource.includes('name: credential.display_name'), true);
  assert.equal(credentialsSource.includes("request.method === 'PATCH'"), true);
  assert.equal(schemaSource.includes('display_name text NOT NULL'), true);
});

test('패스키 관리 화면은 마지막 credential 삭제를 서버에서 차단한다', async () => {
  const source = await readFile(new URL('../api/passkey/credentials.js', import.meta.url), 'utf8');

  assert.equal(source.includes('(SELECT count(*) FROM passkey_credentials) > 1'), true);
  assert.equal(source.includes('SELECT credential_id FROM passkey_credentials FOR UPDATE'), true);
  assert.equal(source.includes('마지막 패스키는 삭제할 수 없습니다.'), true);
});

test('로그인은 매번 새 challenge를 만들고 저장 공개키로 assertion을 검증한다', async () => {
  const optionsSource = await readFile(new URL('../api/passkey/authenticate-options.js', import.meta.url), 'utf8');
  const verifySource = await readFile(new URL('../api/passkey/authenticate-verify.js', import.meta.url), 'utf8');
  const challengeSource = await readFile(new URL('../api/_lib/challenges.js', import.meta.url), 'utf8');

  assert.equal(optionsSource.includes('generateAuthenticationOptions'), true);
  assert.equal(optionsSource.includes("saveChallenge('authentication', options.challenge)"), true);
  assert.equal(verifySource.includes("consumeChallenge(ceremonyId, 'authentication')"), true);
  assert.equal(verifySource.includes('expectedChallenge: challenge.challenge'), true);
  assert.equal(verifySource.includes('publicKey: new Uint8Array(stored.public_key)'), true);
  assert.equal(verifySource.includes('if (!verification.verified)'), true);
  assert.equal(verifySource.includes('await createSession(sql)'), true);
  assert.equal(challengeSource.includes('DELETE FROM webauthn_challenges'), true);
});

test('로그아웃은 세션 쿠키를 지우고 비밀번호 입력칸을 만들지 않는다', async () => {
  const logoutSource = await readFile(new URL('../api/passkey/logout.js', import.meta.url), 'utf8');
  const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const setupSource = await readFile(new URL('../setup/index.html', import.meta.url), 'utf8');

  assert.equal(logoutSource.includes('clearSessionCookie()'), true);
  assert.equal(logoutSource.includes('await revokeSession(request)'), true);
  assert.equal(indexSource.includes('type="password"'), false);
  assert.equal(setupSource.includes('type="password"'), false);
  assert.equal(indexSource.includes('autocomplete="one-time-code"'), true);
  assert.equal(setupSource.includes('autocomplete="one-time-code"'), true);
});

test('로그아웃한 세션만 폐기하고 같은 쿠키 재사용을 거절한다', async () => {
  const originalSessionSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'test-only-session-secret-value-1234567890';
  const storedSessionHashes = new Set();
  const sql = async (strings, ...values) => {
    const query = strings.join(' ');
    if (query.includes('INSERT INTO passkey_sessions')) {
      storedSessionHashes.add(values[0]);
      return [];
    }
    if (query.includes('SELECT 1') && query.includes('FROM passkey_sessions')) {
      return storedSessionHashes.has(values[0]) ? [{ exists: 1 }] : [];
    }
    if (query.includes('RETURNING session_id_hash')) {
      const deleted = storedSessionHashes.delete(values[0]);
      return deleted ? [{ session_id_hash: values[0] }] : [];
    }
    if (query.includes('DELETE FROM passkey_sessions WHERE expires_at')) return [];
    throw new Error(`처리하지 않은 테스트 SQL: ${query}`);
  };

  try {
    const firstCookie = (await createSession(sql)).split(';')[0];
    const secondCookie = (await createSession(sql)).split(';')[0];
    const firstRequest = { headers: { cookie: firstCookie } };
    const secondRequest = { headers: { cookie: secondCookie } };

    assert.equal([...storedSessionHashes].every((value) => /^[a-f0-9]{64}$/.test(value)), true);
    assert.equal(await hasValidSession(firstRequest, sql), true);
    assert.equal(await hasValidSession(secondRequest, sql), true);
    assert.equal(await revokeSession(firstRequest, sql), true);
    assert.equal(await hasValidSession(firstRequest, sql), false);
    assert.equal(await hasValidSession(secondRequest, sql), true);
    assert.equal(clearSessionCookie().includes('Max-Age=0'), true);
  } finally {
    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
  }
});

test('폐기 가능한 세션 테이블은 legacy 제거 뒤 생성한다', async () => {
  const schemaSource = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const migrationDirectory = new URL('../db/migrations/', import.meta.url);
  const migrationNames = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();
  const removeIndex = migrationNames.indexOf('20260928_remove_legacy_passkey_tables.sql');
  const restoreIndex = migrationNames.indexOf('20260928_restore_revocable_passkey_sessions.sql');

  assert.equal(schemaSource.includes('CREATE TABLE IF NOT EXISTS passkey_sessions'), true);
  assert.equal(schemaSource.includes('session_id_hash text PRIMARY KEY'), true);
  assert.ok(removeIndex >= 0 && restoreIndex > removeIndex);
});
