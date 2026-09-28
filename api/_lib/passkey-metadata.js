export function describePasskeyLocation({ transports, deviceType, backedUp }) {
  const availableTransports = Array.isArray(transports) ? transports : [];
  const transportSet = new Set(availableTransports);

  if (transportSet.has('hybrid')) {
    return backedUp
      ? '휴대폰 또는 동기화된 패스키 관리자'
      : '휴대폰·태블릿';
  }
  if (transportSet.has('usb') || transportSet.has('nfc') || transportSet.has('ble')) {
    return '외장 보안 키';
  }
  if (transportSet.has('internal')) {
    return backedUp || deviceType === 'multiDevice'
      ? '동기화된 패스키 관리자'
      : '이 기기의 Windows Hello 또는 기기 잠금';
  }
  if (backedUp || deviceType === 'multiDevice') return '동기화된 패스키 관리자';
  return '저장 위치를 확인할 수 없음';
}
