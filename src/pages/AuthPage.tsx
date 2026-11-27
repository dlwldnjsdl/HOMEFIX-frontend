import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { PageHeader, Field, Button, Icon, PrivacyNote, Tag } from '../components/UI';
import { appPath } from '../lib/appPath';
import type { Role, Session } from '../types/models';
type DemoAccountPreset = {
    label: string;
    detail: string;
    loginId: string;
    role: Role;
    tone: 'rose' | 'sage' | 'lavender';
};
const SCENARIO_ACCOUNTS: DemoAccountPreset[] = [
    { label: '시나리오 1 · 민서', detail: '미닫이문 사례 매칭 (사용자)', loginId: 'demo-user-minseo', role: 'USER', tone: 'rose' },
    { label: '시나리오 1 · 기사 A', detail: '하부 롤러 모의 사례 (기사)', loginId: 'demo-tech-door-a', role: 'TECHNICIAN', tone: 'sage' },
    { label: '시나리오 2 · 지훈', detail: '수전 교체 동선 할인 (사용자)', loginId: 'demo-user-jihoon', role: 'USER', tone: 'rose' },
    { label: '시나리오 2 · 기사-2', detail: '목요일 출장 동선 기사 (기사)', loginId: 'demo-tech-01', role: 'TECHNICIAN', tone: 'sage' },
    { label: '시나리오 3 · 서연', detail: '벽지 물자국 경과·PDF (임차인)', loginId: 'demo-user-seoyeon', role: 'USER', tone: 'lavender' },
    { label: '시나리오 3 · 기사-3', detail: '확정 예약 인계·준비사항 (기사)', loginId: 'demo-tech-03', role: 'TECHNICIAN', tone: 'sage' },
];
export default function AuthPage() {
    const { route, navigate, setSession, mutate, busy } = useApp();
    const register = route.screen === 'signup';
    const initialPreset = !register && route.id ? SCENARIO_ACCOUNTS.find(x => x.loginId === route.id) : undefined;
    const [loginId, setLoginId] = useState(initialPreset ? initialPreset.loginId : (!register && route.id ? route.id : ''));
    const [password, setPassword] = useState('');
    const [preferredRole, setPreferredRole] = useState<Role>(initialPreset ? initialPreset.role : 'USER');
    const passwordRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!register && route.id) {
            const matched = SCENARIO_ACCOUNTS.find(x => x.loginId === route.id);
            setLoginId(route.id);
            setPreferredRole(matched ? matched.role : 'USER');
            passwordRef.current?.focus();
        }
    }, [register, route.id]);

    function selectScenarioAccount(preset: DemoAccountPreset) {
        if (register) {
            navigate('login', preset.loginId);
            return;
        }
        setLoginId(preset.loginId);
        setPreferredRole(preset.role);
        passwordRef.current?.focus();
    }

    async function submit(e: FormEvent) {
        e.preventDefault();
        await mutate(async () => {
            if (register)
                await api.signup(loginId, password);
            let user = await api.login(loginId, password) as Session;
            if (!register && preferredRole === 'TECHNICIAN' && user.availableRoles?.includes('TECHNICIAN')) {
                if (user.activeRole !== 'TECHNICIAN') {
                    user = await api.role('TECHNICIAN') as Session;
                }
                setSession(user);
                navigate('tech');
                return;
            }
            setSession(user);
            navigate('home');
        }, register ? '가입하고 로그인했어요.' : preferredRole === 'TECHNICIAN' ? '기사 모드로 로그인했어요.' : '다시 만나서 반가워요.');
    }

    return <><PageHeader title={register ? '회원가입' : '로그인'}/>
        <div className="rx-body rx-login">
            <img src={appPath('assets/brand-app-icon.png')} alt="고쳐야집"/>
            <span className="rx-overline">WELCOME HOME</span>
            <h1>{register ? '우리 집 홈케어 시작하기' : '우리 집, 더 편안하게'}</h1>
            <p>혼자서도 뚝딱, 고쳐야ZIP!</p>
            <form onSubmit={submit} className="rx-form">
                <Field label="로그인 아이디">
                    <input
                        autoComplete="username"
                        required
                        value={loginId}
                        onChange={e => {
                            const nextId = e.target.value;
                            setLoginId(nextId);
                            const matched = SCENARIO_ACCOUNTS.find(x => x.loginId === nextId);
                            setPreferredRole(matched ? matched.role : 'USER');
                        }}
                        placeholder="아이디를 입력해 주세요"
                    />
                </Field>
                <Field label="비밀번호" hint={!register ? '시연 계정은 시드 적재 시 출력된 공용 비밀번호를 입력해 주세요.' : undefined}>
                    <input
                        ref={passwordRef}
                        type="password"
                        autoComplete={register ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="비밀번호"
                    />
                </Field>
                <Button type="submit" disabled={busy}>
                    {register ? '회원가입하고 시작하기' : preferredRole === 'TECHNICIAN' ? '기사 모드로 로그인하기' : '로그인하기'} <Icon name="arrow" size={18}/>
                </Button>
            </form>
            <button className="rx-link rx-auth-switch" onClick={() => navigate(register ? 'login' : 'signup')}>
                {register ? '계정이 있으신가요? 로그인' : '처음이신가요? 회원가입'}
            </button>
            <section className="rx-card rx-demo-accounts">
                <div className="rx-inline" style={{ justifyContent: 'space-between' }}>
                    <h3>시나리오 시연 계정 빠른 선택</h3>
                    <Tag tone="lavender">시드 계정</Tag>
                </div>
                <p className="rx-muted" style={{ textAlign: 'left', margin: 0 }}>
                    버튼을 누르면 로그인 아이디가 자동 입력됩니다. 기사 계정은 로그인 시 자동으로 기사 모드로 전환됩니다.
                </p>
                <div className="rx-demo-grid">
                    {SCENARIO_ACCOUNTS.map(preset => <button
                        key={preset.loginId}
                        type="button"
                        className={`rx-demo-btn ${loginId === preset.loginId ? 'active' : ''}`}
                        onClick={() => selectScenarioAccount(preset)}
                    >
                        <div className="rx-inline" style={{ justifyContent: 'space-between', width: '100%' }}>
                            <strong>{preset.label}</strong>
                            <Tag tone={preset.tone}>{preset.role === 'TECHNICIAN' ? '기사' : '사용자'}</Tag>
                        </div>
                        <small>{preset.detail}</small>
                        <code>{preset.loginId}</code>
                    </button>)}
                </div>
            </section>
            <PrivacyNote>로그인은 서버에서 발급하는 세션 쿠키로 관리하며 비밀번호를 브라우저에 저장하지 않아요.</PrivacyNote>
        </div>
    </>;
}
