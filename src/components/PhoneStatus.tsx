import { useEffect, useState } from 'react';
function seoulTime(): string {
    return new Date().toLocaleTimeString('ko-KR', {
        timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false
    });
}
/** Visual iPhone-like chrome; does not claim to read device network state. */
export function PhoneStatus() {
    const [time, setTime] = useState(seoulTime);
    useEffect(() => {
        const interval = window.setInterval(() => setTime(seoulTime()), 30000);
        return () => window.clearInterval(interval);
    }, []);
    return (<div className="phone-status">
      <span className="time" id="live-clock">{time}</span>
      <span className="dynamic-island" aria-hidden="true"><i /></span>
      <span className="status-right" aria-label="휴대전화 신호·와이파이·배터리 모양의 화면 장식">
        <svg viewBox="0 0 20 16" width="14" height="14" aria-hidden="true">
          <rect x="1" y="10" width="3" height="5" rx="1"/>
          <rect x="6" y="7" width="3" height="8" rx="1"/>
          <rect x="11" y="4" width="3" height="11" rx="1"/>
          <rect x="16" y="1" width="3" height="14" rx="1"/>
        </svg>
        <svg viewBox="0 0 19 16" width="15" height="14" aria-hidden="true">
          <path d="M1 5.5 Q9.5 -1 18 5.5 M4 8.8 Q9.5 4.5 15 8.8 M7.4 12 Q9.5 10.3 11.6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <circle cx="9.5" cy="14" r="1.5"/>
        </svg>
        <svg viewBox="0 0 27 15" width="22" height="14" aria-hidden="true">
          <rect x="1" y="1" width="22" height="13" rx="3.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <rect x="3.4" y="3.3" width="17" height="8.4" rx="1.8"/>
          <path d="M25 5v5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </span>
    </div>);
}
