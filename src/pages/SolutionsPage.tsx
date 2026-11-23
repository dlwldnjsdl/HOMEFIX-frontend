import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useRemote } from '../hooks/useRemote';
import { PageHeader, Spinner, ErrorState, Icon, Button, Field, PrivacyNote, Tag } from '../components/UI';
import { firstWork, id, safeExternalContact, statusLabel } from '../lib/format';
import type { Request } from '../types/models';

const PRODUCT_PRESETS = [
    { label: '시나리오 1: 미닫이문', productType: '미닫이문', manufacturer: '고쳐야집 모의 도어', modelName: 'SD-100' },
    { label: '시나리오 2: 싱크대 수전', productType: '싱크대 수전', manufacturer: '고쳐야집 모의 수전', modelName: 'FK-200' },
    { label: '시나리오 3: 벽지·창호', productType: '벽지', manufacturer: '고쳐야집 모의 창호', modelName: 'WIN-240' },
];

export default function SolutionsPage() {
    const { route, navigate, mutate, busy } = useApp();
    const { data: request, loading, error, refresh: refreshRequest } = useRemote<Request>(() => api.request(route.id!) as Promise<Request>, [route.id]);
    const work = firstWork(request);
    const { data: solutions, loading: solutionsLoading, error: solutionsError, refresh: refreshSolutions } = useRemote<any>(() => work ? api.workSolutions(work.workItemId) : Promise.resolve(null), [work?.workItemId, work?.revision]);
    const [action, setAction] = useState(''), [description, setDescription] = useState(''), [result, setResult] = useState('RESOLVED');
    const [productType, setProductType] = useState('');
    const [manufacturer, setManufacturer] = useState('');
    const [modelName, setModelName] = useState('');

    useEffect(() => {
        const p = (work?.facts?.product || {}) as Record<string, string | null | undefined>;
        setProductType(p.productType || '');
        setManufacturer(p.manufacturer || '');
        setModelName(p.modelName || '');
    }, [work?.workItemId, work?.revision]);

    async function saveProduct() {
        if (!request || !work)
            return;
        await mutate(async () => {
            const latestReq = await api.request(request.requestId) as Request;
            const latestWork = latestReq.workItems?.find(w => w.workItemId === work.workItemId) || firstWork(latestReq);
            if (!latestWork?.workItemId)
                throw Error('작업 항목을 찾을 수 없어요.');
            const wasConfirmed = latestWork.reviewStatus === 'CONFIRMED';
            const updated = await api.patchWorkItem(latestWork.workItemId, {
                expectedRevision: latestWork.revision,
                facts: {
                    product: {
                        productType: productType.trim() || null,
                        manufacturer: manufacturer.trim() || null,
                        modelName: modelName.trim() || null,
                    },
                },
            }) as any;
            if (wasConfirmed && updated?.summary?.text && updated?.facts?.fields?.length) {
                await api.confirmWork(updated.workItemId, {
                    expectedRevision: updated.revision,
                    sourceRevision: updated.sourceRevision,
                    fields: updated.facts.fields,
                    confirmed: true,
                    summary: updated.summary,
                });
            }
            await refreshRequest();
            await refreshSolutions();
        }, '제품 정보를 반영해 셀프 수리·공식 AS 안내를 갱신했어요.');
    }

    async function record(path: 'SELF_HELP' | 'MANUFACTURER_AS') {
        if (!work)
            return;
        await mutate(async () => {
            await api.post(`/work-items/${id(work.workItemId)}/outcomes`, { outcome: { path, result, action, description, occurredOn: null, photoIds: [] } }, true);
            setAction('');
            setDescription('');
        }, '해결 결과를 기록했어요.');
    }

    if (loading || solutionsLoading)
        return <><PageHeader title="해결 방법"/><Spinner /></>;
    if (error || solutionsError)
        return <><PageHeader title="해결 방법"/><ErrorState message={error || solutionsError || ''}/></>;
    return <><PageHeader title="내게 맞는 해결 방법" right={<button className="rx-iconbtn" onClick={() => { void refreshRequest(); void refreshSolutions(); }}><Icon name="refresh"/></button>}/><div className="rx-body"><div className="rx-ai-welcome"><span className="rx-ai-orbit"><Icon name="shield"/></span><div><h2>혼자 해결할 수 있을까요?</h2><p>서버가 확인한 공식 안내와 가능한 경로를 보여드려요.</p></div></div>
    <div className="rx-card rx-form">
        <div className="rx-inline" style={{ justifyContent: 'space-between' }}>
            <h3>제품 정보로 맞춤 가이드 · 공식 AS 조회</h3>
            <Tag tone={manufacturer ? 'sage' : 'lavender'}>{manufacturer ? '제조사 입력됨' : '선택 입력'}</Tag>
        </div>
        <div className="rx-chips">
            {PRODUCT_PRESETS.map(p => (
                <button key={p.label} type="button" onClick={() => { setProductType(p.productType); setManufacturer(p.manufacturer); setModelName(p.modelName); }}>
                    {p.label}
                </button>
            ))}
        </div>
        <div className="rx-duo-buttons">
            <Field label="제품 종류"><input value={productType} onChange={e => setProductType(e.target.value)} placeholder="예) 미닫이문, 싱크대 수전"/></Field>
            <Field label="제조사"><input value={manufacturer} onChange={e => setManufacturer(e.target.value)} placeholder="예) 고쳐야집 모의 도어"/></Field>
        </div>
        <Field label="모델명 (선택)"><input value={modelName} onChange={e => setModelName(e.target.value)} placeholder="예) SD-100"/></Field>
        <Button kind="outline" disabled={busy || (!productType.trim() && !manufacturer.trim() && !modelName.trim())} onClick={() => void saveProduct()}>제품 정보 저장하고 안내 다시 조회</Button>
    </div>
    <div className="rx-card">
        <div className="rx-inline"><Icon name="tool"/><h3>셀프 수리 · 검증된 가이드</h3></div>
        <Tag tone={solutions?.selfHelp?.status === 'AVAILABLE' ? 'sage' : 'rose'}>{statusLabel(solutions?.selfHelp?.status) || '안내 없음'}</Tag>
        <p>{solutions?.selfHelp?.message}</p>
        {(solutions?.selfHelp?.guides || []).map((g: any) => <div key={g.guideId} className="rx-guide">
            <h4>{g.source?.title || '적용 가능한 가이드'}</h4>
            {g.conditions?.length > 0 && <p><strong>적용 조건:</strong> {g.conditions.join(' · ')}</p>}
            {g.supplies?.length > 0 && <p><strong>준비물:</strong> {g.supplies.join(', ')}</p>}
            {g.applicable && <ol>{g.steps?.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol>}
            {g.warnings?.length > 0 && <p className="rx-warn">주의: {g.warnings.join(' · ')}</p>}
            {g.prohibitions?.length > 0 && <p className="rx-warn">금지: {g.prohibitions.join(' · ')}</p>}
            {g.stopConditions?.length > 0 && <p><strong>즉시 중단 기준:</strong> {g.stopConditions.join(' · ')}</p>}
            {g.source && <small>출처: {g.source.title || g.source.name || '검증된 가이드'} ({g.source.verifiedAt || g.source.version})</small>}
        </div>)}
    </div>
    <div className="rx-card">
        <div className="rx-inline"><Icon name="headset"/><h3>제조사 공식 AS</h3></div>
        <Tag tone={solutions?.officialService?.status === 'AVAILABLE' ? 'sage' : 'rose'}>{statusLabel(solutions?.officialService?.status) || '안내 없음'}</Tag>
        <p>{solutions?.officialService?.message}</p>
        {(solutions?.officialService?.routes || []).map((r: any, i: number) => {
            const href = safeExternalContact(r.contact || '');
            return <div className="rx-official" key={i}>
                <strong>{r.label}</strong>
                <p>{r.productSpecific ? '제품·제조사별 공식 지원 경로' : '일반 공식 지원 경로'}</p>
                {href ? <a href={href} target={href.startsWith('https:') ? '_blank' : undefined} rel="noopener noreferrer">{r.contact} <Icon name="arrow" size={15}/></a> : <span>{r.contact}</span>}
            </div>;
        })}
    </div>
    <div className="rx-card rx-form"><h3>직접 해결했나요?</h3><p>시도한 방법과 결과는 내 수리 기록에 남길 수 있어요.</p><Field label="시도한 조치"><input value={action} onChange={e => setAction(e.target.value)} placeholder="예) 점검 가이드 1~3단계 확인"/></Field><Field label="결과"><select value={result} onChange={e => setResult(e.target.value)}><option value="RESOLVED">해결됨</option><option value="UNRESOLVED">미해결</option><option value="UNAVAILABLE">이용 불가</option></select></Field><Field label="상세 메모"><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}/></Field><Button kind="outline" disabled={!action || !description || busy} onClick={() => void record('SELF_HELP')}>셀프 점검 결과 기록</Button><Button kind="outline" disabled={!action || !description || busy} onClick={() => void record('MANUFACTURER_AS')}>공식 AS 결과 기록</Button></div>
    <div className="rx-card rx-cta-card">
        <Icon name="tool"/>
        <h3>전문가의 도움이 필요하다면</h3>
        <p>AI가 기사 포트폴리오(과거 수리 사례)를 비교해 맞춤 기사를 추천하거나, 전체 공개 기사 목록을 직접 확인할 수 있어요.</p>
        {request && work ? <>
            <Button onClick={() => navigate('candidates', `${request.requestId}:${work.workItemId}`)}>맞춤 기사 · AI 사례 매칭 보기 <Icon name="arrow"/></Button>
            <div className="rx-duo-buttons" style={{ width: '100%' }}>
                <Button kind="outline" onClick={() => navigate('detail', request.requestId)}>작업·방문 조건 설정</Button>
                <Button kind="ghost" onClick={() => navigate('experts')}>전체 공개 기사 목록</Button>
            </div>
        </> : <Button onClick={() => navigate('experts')}>수리기사 찾아보기 <Icon name="arrow"/></Button>}
    </div><PrivacyNote>AI는 확인된 가이드의 의미·순서를 바꾸지 않아요. 공식 경로가 없으면 임의로 생성하지 않아요.</PrivacyNote></div></>;
}
