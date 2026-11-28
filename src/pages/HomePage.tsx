import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { Section, Icon, RequestCard, PrivacyNote } from '../components/UI';
import { appPath } from '../lib/appPath';
import { fieldImages, fieldNames, itemsOf } from '../lib/format';
import type { Request } from '../types/models';
const capabilities = [{ label: 'AI와 먼저 상담', description: '사진과 추가 질문으로 문제 파악', icon: 'spark', screen: 'new' as const }, { label: '기사 직접 찾기', description: '로그인 없이 공개 기사 탐색', icon: 'tool', screen: 'experts' as const }];
export default function HomePage() {
    const { session, navigate } = useApp();
    const [requests, setRequests] = useState<Request[]>([]);
    useEffect(() => { if (session?.activeRole === 'USER')
        api.requests().then(data => setRequests(itemsOf<Request>(data))).catch(() => setRequests([])); }, [session?.activeRole]);
    return <div className="rx-home">
    <header className="rx-homehead">
        <div className="rx-brand">
            <img src={appPath('assets/brand-app-icon.png')} alt="고쳐야집 공식 아이콘"/>
            <div><strong>고쳐야집</strong><small>혼자서도 뚝딱, 고쳐야ZIP!</small></div>
        </div>
        <div className="rx-home-actions">
            <button className="rx-region" onClick={() => navigate('profile')}><Icon name="pin" size={13}/> 우리 집 지역</button>
            <button className="rx-iconbtn" onClick={() => navigate('profile')} aria-label="마이페이지"><Icon name="user"/></button>
        </div>
    </header>
    <div className="rx-greeting"><span className="rx-overline">✦ 우리 집에 꼭 맞는 홈케어</span><h1>오늘도 우리 집을,<br /><em>더 편안하게</em></h1><p>사진으로 손쉽게 살펴보고, 가장 알맞은 해결 방법까지.</p></div>
    <button className="rx-hero" onClick={() => navigate('new')}>
        <div className="rx-hero-copy">
            <span className="rx-overline">PHOTO TO SOLUTION</span>
            <h2>우리 집 고장,<br />AI에게 물어봐요</h2>
            <p>사진 한 장으로 시작하는<br />맞춤 진단과 해결 가이드</p>
            <span className="rx-hero-action"><Icon name="camera"/>AI 사진 진단 시작 <Icon name="arrow"/></span>
        </div>
        <img src={appPath('assets/hero-house-new.webp')} alt="따뜻한 집 일러스트"/>
    </button>
    <Section title="우리 집, 어디가 아픈가요?" detail="문제 부위를 골라 사진으로 알려주세요.">
        <div className="rx-categories">
            {fieldNames.map((name, i) => <button key={name} onClick={() => navigate('new')} className="rx-category">
                <span><img src={appPath(`assets/${fieldImages[i]}`)} alt=""/></span>
                <small>{name}</small>
            </button>)}
        </div>
    </Section>
    <Section title="해결 방법은 함께 찾아요" detail="AI가 확인한 뒤, 내가 선택해요."><div className="rx-ways">{capabilities.map(item => <button key={item.label} className="rx-way" onClick={() => navigate(item.screen)}><span className="rx-way-icon"><Icon name={item.icon} size={24}/></span><strong>{item.label}</strong><small>{item.description}</small><Icon name="arrow" size={17}/></button>)}</div><button className="rx-as-link" onClick={() => navigate('solutions')}><Icon name="shield" size={20}/> 제조사 공식 AS가 필요한가요? <Icon name="chevron" size={16}/></button></Section>
    {session?.activeRole === 'USER' && <Section title="진행 중인 우리 집 수리" detail="필요한 내용을 한눈에 확인해요." action={<button className="rx-link" onClick={() => navigate('requests')}>전체 보기 <Icon name="chevron" size={14}/></button>}>{requests.slice(0, 2).map(r => <RequestCard key={r.requestId} request={r}/>)}{requests.length === 0 && <div className="rx-softline">아직 진행 중인 수리가 없어요. 사진을 등록하고 우리 집 기록을 시작해 보세요.</div>}</Section>}
    <div className="rx-home-footer"><Icon name="spark"/> 우리 집 홈케어, 혼자서도 뚝딱 고쳐야ZIP!</div><PrivacyNote>긴급 상황에서는 AI 판단을 기다리지 말고 안전을 확보한 뒤 적절한 긴급 연락처를 이용하세요.</PrivacyNote></div>;
}
