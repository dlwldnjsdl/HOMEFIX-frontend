import { useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useRemote } from '../hooks/useRemote';
import { PageHeader, Spinner, ErrorState, Icon, Button, Field, PrivacyNote, Tag } from '../components/UI';
import { firstWork, id, safeExternalContact } from '../lib/format';
import type { Request } from '../types/models';
export default function SolutionsPage() {
    const { route, navigate, mutate, busy } = useApp();
    const { data: request, loading, error } = useRemote<Request>(() => api.request(route.id!) as Promise<Request>, [route.id]);
    const work = firstWork(request);
    const { data: solutions, loading: solutionsLoading, error: solutionsError } = useRemote<any>(() => work ? api.workSolutions(work.workItemId) : Promise.resolve(null), [work?.workItemId]);
    const [action, setAction] = useState(''), [description, setDescription] = useState(''), [result, setResult] = useState('RESOLVED');
    async function record(path: 'SELF_HELP' | 'MANUFACTURER_AS') { if (!work)
        return; await mutate(async () => { await api.post(`/work-items/${id(work.workItemId)}/outcomes`, { outcome: { path, result, action, description, occurredOn: null, photoIds: [] } }, true); setAction(''); setDescription(''); }, '해결 결과를 기록했어요.'); }
    if (loading || solutionsLoading)
        return <><PageHeader title="해결 방법"/><Spinner /></>;
    if (error || solutionsError)
        return <><PageHeader title="해결 방법"/><ErrorState message={error || solutionsError || ''}/></>;
    return <><PageHeader title="내게 맞는 해결 방법"/><div className="rx-body"><div className="rx-ai-welcome"><span className="rx-ai-orbit"><Icon name="shield"/></span><div><h2>혼자 해결할 수 있을까요?</h2><p>서버가 확인한 공식 안내와 가능한 경로를 보여드려요.</p></div></div>
    <div className="rx-card"><div className="rx-inline"><Icon name="tool"/><h3>셀프 수리 · 검증된 가이드</h3></div><Tag tone={solutions?.selfHelp?.status === 'AVAILABLE' ? 'sage' : 'rose'}>{solutions?.selfHelp?.status || '안내 없음'}</Tag><p>{solutions?.selfHelp?.message}</p>{(solutions?.selfHelp?.guides || []).map((g: any) => <div key={g.guideId} className="rx-guide"><h4>적용 가능한 가이드</h4>{g.conditions?.length > 0 && <p>적용 조건: {g.conditions.join(' · ')}</p>}{g.applicable && <ol>{g.steps?.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol>}{g.warnings?.length > 0 && <p className="rx-warn">주의: {g.warnings.join(' · ')}</p>}{g.prohibitions?.length > 0 && <p className="rx-warn">금지: {g.prohibitions.join(' · ')}</p>}{g.stopConditions?.length > 0 && <p>즉시 중단: {g.stopConditions.join(' · ')}</p>}{g.source && <small>출처: {g.source.title || g.source.name || '검증된 가이드'}</small>}</div>)}</div>
    <div className="rx-card"><div className="rx-inline"><Icon name="headset"/><h3>제조사 공식 AS</h3></div><Tag tone="sage">{solutions?.officialService?.status || '안내 없음'}</Tag><p>{solutions?.officialService?.message}</p>{(solutions?.officialService?.routes || []).map((r: any, i: number) => { const href = safeExternalContact(r.contact || ''); return <div className="rx-official" key={i}><strong>{r.label}</strong><p>{r.productSpecific ? '제품별 공식 지원 경로' : '일반 공식 지원 경로'}</p>{href ? <a href={href} target={href.startsWith('https:') ? '_blank' : undefined} rel="noopener noreferrer">공식 경로 열기 <Icon name="arrow" size={15}/></a> : <span>{r.contact}</span>}</div>; })}</div>
    <div className="rx-card rx-form"><h3>직접 해결했나요?</h3><p>시도한 방법과 결과는 내 수리 기록에 남길 수 있어요.</p><Field label="시도한 조치"><input value={action} onChange={e => setAction(e.target.value)} placeholder="예) 점검 가이드 1~3단계 확인"/></Field><Field label="결과"><select value={result} onChange={e => setResult(e.target.value)}><option value="RESOLVED">해결됨</option><option value="UNRESOLVED">미해결</option><option value="UNAVAILABLE">이용 불가</option></select></Field><Field label="상세 메모"><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}/></Field><Button kind="outline" disabled={!action || !description || busy} onClick={() => void record('SELF_HELP')}>셀프 점검 결과 기록</Button><Button kind="outline" disabled={!action || !description || busy} onClick={() => void record('MANUFACTURER_AS')}>공식 AS 결과 기록</Button></div>
    <div className="rx-card rx-cta-card"><Icon name="tool"/><h3>전문가의 도움이 필요하다면</h3><p>AI 없이 직접 기사 정보를 확인하거나, 내 증상에 맞는 후보를 찾아볼 수 있어요.</p><Button onClick={() => navigate('experts')}>수리기사 찾아보기 <Icon name="arrow"/></Button></div><PrivacyNote>AI는 확인된 가이드의 의미·순서를 바꾸지 않아요. 공식 경로가 없으면 임의로 생성하지 않아요.</PrivacyNote></div></>;
}
