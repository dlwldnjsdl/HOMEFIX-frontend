import { useState, type FormEvent } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { PageHeader, Field, Button, Icon, PrivacyNote } from '../components/UI';
import type { Session } from '../types/models';
export default function AuthPage() {
    const { route, navigate, setSession, mutate, busy } = useApp();
    const register = route.screen === 'signup';
    const [loginId, setLoginId] = useState(''), [password, setPassword] = useState('');
    async function submit(e: FormEvent) { e.preventDefault(); if (register && password.length < 12)
        return; await mutate(async () => { if (register)
        await api.signup(loginId, password); const user = await api.login(loginId, password) as Session; setSession(user); navigate('home'); }, register ? '가입하고 로그인했어요.' : '다시 만나서 반가워요.'); }
    return <><PageHeader title={register ? '회원가입' : '로그인'}/><div className="rx-body rx-login"><img src="/assets/brand-app-icon.png" alt="고쳐야집"/><span className="rx-overline">WELCOME HOME</span><h1>{register ? '우리 집 홈케어 시작하기' : '우리 집, 더 편안하게'}</h1><p>혼자서도 뚝딱, 고쳐야ZIP!</p><form onSubmit={submit} className="rx-form"><Field label="로그인 아이디"><input autoComplete="username" required value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="아이디를 입력해 주세요"/></Field><Field label="비밀번호" hint={register ? '12자 이상 설정해 주세요.' : undefined}><input type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : undefined} required value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호"/></Field><Button type="submit" disabled={busy}>{register ? '회원가입하고 시작하기' : '로그인하기'} <Icon name="arrow" size={18}/></Button></form><button className="rx-link rx-auth-switch" onClick={() => navigate(register ? 'login' : 'signup')}>{register ? '계정이 있으신가요? 로그인' : '처음이신가요? 회원가입'}</button><PrivacyNote>로그인은 서버에서 발급하는 세션 쿠키로 관리하며 비밀번호를 브라우저에 저장하지 않아요.</PrivacyNote></div></>;
}
