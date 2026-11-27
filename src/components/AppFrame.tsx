import type { ReactNode } from 'react';
import { PhoneStatus } from './PhoneStatus';
import { Icon } from './UI';
import { useApp, type Screen } from '../context/AppContext';
import { appPath } from '../lib/appPath';
const userTabs: {
    id: Screen;
    label: string;
    icon: string;
}[] = [{ id: 'requests', label: '내 요청', icon: 'file' }, { id: 'experts', label: '기사 찾기', icon: 'search' }, { id: 'home', label: '홈', icon: 'home' }, { id: 'bookings', label: '예약', icon: 'calendar' }, { id: 'profile', label: '마이', icon: 'user' }];
const techTabs: {
    id: Screen;
    label: string;
    icon: string;
}[] = [{ id: 'tech', label: '기사 업무', icon: 'tool' }, { id: 'consultations', label: '상담', icon: 'chat' }, { id: 'home', label: '홈', icon: 'home' }, { id: 'bookings', label: '일정', icon: 'calendar' }, { id: 'profile', label: '내 정보', icon: 'user' }];
const primary: Screen[] = ['home', 'requests', 'experts', 'bookings', 'profile', 'tech', 'consultations'];
export function AppFrame({ children }: {
    children: ReactNode;
}) {
    const { route, session, navigate, toast, clearToast } = useApp();
    const isTech = session?.activeRole === 'TECHNICIAN';
    const showTabs = primary.includes(route.screen);
    const tabs = isTech ? techTabs : userTabs;
    const current = (screen: Screen) => screen === route.screen || (screen === 'requests' && ['detail', 'ai', 'solutions', 'quotes', 'records', 'report'].includes(route.screen));
    return <div className="desktop-stage"><div className="ambient ambient-one"/><div className="ambient ambient-two"/>
    <div className="phone-shell"><PhoneStatus /><div className="app-canvas">
      <main className={`page-content ${showTabs ? 'with-tabs' : ''}`} id="page-scroll">{children}</main>
      {showTabs && <nav className="rx-tabs" aria-label="앱 메뉴">{tabs.map(tab => <button key={tab.id} className={`rx-tab ${tab.id === 'home' ? 'rx-tab-center' : ''} ${current(tab.id) ? 'active' : ''}`} onClick={() => navigate(tab.id)} aria-current={current(tab.id) ? 'page' : undefined}><span className="rx-tab-symbol"><Icon name={tab.icon} size={22}/></span><span>{tab.label}</span></button>)}</nav>}
    </div></div>
    <aside className="desktop-side">
        <div className="side-logo">
            <img src={appPath('assets/brand-app-icon.png')} alt=""/>
            <span>고쳐야집</span>
        </div>
        <p className="side-title">혼자서도 뚝딱,<br />고쳐야ZIP!</p>
        <p>사진 한 장에서 시작하는 우리 집 홈케어<br />React + TypeScript 웹 플랫폼</p>
        <div className="side-line"/>
        <span>DESIGNED FOR YOUR HOME · 2026</span>
    </aside>
    {toast && <div key={toast.id} className={`rx-toast ${toast.kind} ${toast.leaving ? 'leaving' : ''}`} role="status" onClick={clearToast}><Icon name={toast.kind === 'error' ? 'alert' : 'check'}/>{toast.message}</div>}
  </div>;
}
