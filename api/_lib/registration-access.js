export function getRegistrationAccess({ sessionAuthorized, setupAuthorized, hasCredential, newAccount = false }) {
  if (sessionAuthorized) return { allowed: true, bootstrap: false };
  if (newAccount && hasCredential) return { allowed: true, bootstrap: false };
  if (!setupAuthorized) {
    return { allowed: false, status: 403, error: '패스키 등록 권한이 없습니다.' };
  }
  if (hasCredential) {
    return { allowed: false, status: 409, error: '최초 패스키 설정은 이미 완료되었습니다.' };
  }
  return { allowed: true, bootstrap: true };
}
