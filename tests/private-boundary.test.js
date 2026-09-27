import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { getRegistrationAccess } from '../api/_lib/registration-access.js';
import privateItemsHandler from '../api/private-items.js';
import registerOptionsHandler from '../api/passkey/register-options.js';
import { shouldStartPasskeyRegistration } from '../passkey-client.js';

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
