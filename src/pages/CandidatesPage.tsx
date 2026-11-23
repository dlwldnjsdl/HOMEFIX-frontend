import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useRemote } from '../hooks/useRemote';
import { Button, Empty, ErrorState, Icon, MediaImage, Modal, PageHeader, PrivacyNote, Spinner, Tag } from '../components/UI';
import { allPhotos, fieldLabel, firstWork, id, itemsOf, statusLabel } from '../lib/format';
import type { AiJob, Request, Technician, Photo, WorkItem } from '../types/models';
type Candidate = {
    technician: Technician;
    matchedFields?: string[];
    unsupportedFields?: string[];
    timeFit?: string;
    durationEstimate?: { minutes?: number | null };
    checks?: Array<{
        reason?: string;
        code?: string;
    }>;
};
type ScoredCase = {
    score: number;
    evidence?: string[];
    case?: {
        caseId: string;
        content?: {
            title?: string;
            initialSymptom?: string;
            confirmedCause?: string | null;
            workDescription?: string;
            parts?: string[];
            dataType?: string;
            source?: { title?: string };
        };
        beforePhotos?: Array<{ mediaId: string }>;
        afterPhotos?: Array<{ mediaId: string }>;
    };
};
type CaseRecommendation = {
    candidate: Candidate;
    rank: number;
    averageScore: number;
    cases?: ScoredCase[];
};
type InterestRow = {
    interestId: string;
    candidateId: string;
    technician: Technician;
    createdAt: string;
};
type Delivery = {
    deliveryId: string;
    revision: string;
    sourceRevision: string;
    status: string;
    reviewStatus?: string;
    metadataRemoved?: boolean;
    scope?: Record<string, unknown>;
    content?: {
        summary?: unknown;
        quoteContext?: unknown;
        [key: string]: unknown;
    } | null;
    error?: {
        message?: string;
    };
};
/** Recommendations are evidence-based; general candidates have no fabricated score. */
export default function CandidatesPage() {
    const { route, navigate, session, mutate, busy, notice } = useApp();
    const [requestId, workItemId] = (route.id || '').split(':');
    const { data: request, loading, error, refresh: refreshRequest } = useRemote<Request>(() => api.request(requestId) as Promise<Request>, [requestId]);
    const work = request?.workItems.find(item => item.workItemId === workItemId) || firstWork(request);
    const isConfirmed = work?.reviewStatus === 'CONFIRMED';
    const { data: cases, loading: casesLoading, error: casesError, refresh: refreshCases } = useRemote<any>(() => (work && isConfirmed) ? api.caseRecommendations(work.workItemId) : Promise.resolve(null), [work?.workItemId, work?.revision, isConfirmed]);
    const { data: general, loading: generalLoading, error: generalError, refresh: refreshGeneral } = useRemote<any>(() => (work && isConfirmed) ? api.generalCandidates(work.workItemId) : Promise.resolve(null), [work?.workItemId, work?.revision, isConfirmed]);
    const { data: interests, refresh: refreshInterests } = useRemote<any>(() => work ? api.workInterests(work.workItemId).catch(() => []) : Promise.resolve([]), [work?.workItemId, work?.revision]);
    const [matchJob, setMatchJob] = useState<AiJob | null>(null);
    const [chosen, setChosen] = useState<Technician | null>(null);
    const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
    const [shareAcknowledged, setShareAcknowledged] = useState(false);
    const [delivery, setDelivery] = useState<Delivery | null>(null);
    const [confirmedReview, setConfirmedReview] = useState(false);

    const photos = allPhotos(request);
    const scored = Array.isArray(cases?.recommendations) ? cases.recommendations as CaseRecommendation[] : [];
    const scoredIds = new Set(scored.map(x => x.candidate.technician.technicianId));
    const allGeneral = itemsOf<Candidate>(general);
    const eligibleGeneral = allGeneral.filter(x => x.timeFit !== 'NOT_MATCHED' && !scoredIds.has(x.technician.technicianId));
    const excludedGeneral = allGeneral.filter(x => x.timeFit === 'NOT_MATCHED');
    const interestRows = itemsOf<InterestRow>(interests);

    useEffect(() => {
        if (!matchJob || !['QUEUED', 'RUNNING'].includes(matchJob.status))
            return;
        let alive = true;
        const timer = window.setInterval(() => {
            void api.aiStatus(matchJob.jobId).then((j: AiJob) => {
                if (!alive)
                    return;
                setMatchJob(j);
                if (!['QUEUED', 'RUNNING'].includes(j.status)) {
                    void refreshCases();
                    void refreshGeneral();
                }
            }).catch(() => { });
        }, 1500);
        return () => { alive = false; window.clearInterval(timer); };
    }, [matchJob?.jobId, matchJob?.status, refreshCases, refreshGeneral]);

    useEffect(() => {
        if (!delivery || !['QUEUED', 'PROCESSING'].includes(delivery.status))
            return;
        let alive = true;
        const timer = window.setInterval(() => {
            void api.delivery(delivery.deliveryId).then((d: Delivery) => {
                if (alive)
                    setDelivery(d);
            }).catch(() => { });
        }, 1200);
        return () => { alive = false; window.clearInterval(timer); };
    }, [delivery?.deliveryId, delivery?.status]);

    async function reconfirmNow() {
        if (!request || !work)
            return;
        await mutate(async () => {
            const fresh = await api.request(request.requestId) as Request;
            const freshWork = fresh.workItems.find(item => item.workItemId === work.workItemId) || firstWork(fresh);
            if (!freshWork?.workItemId)
                throw Error('작업 항목을 찾을 수 없어요.');
            const fields = freshWork.facts?.fields?.length ? freshWork.facts.fields : [];
            if (!fields.length)
                throw Error('수리 분야가 선택되지 않았어요. [작업·방문 조건 수정]에서 분야를 먼저 지정해 주세요.');
            await api.confirmWork(freshWork.workItemId, {
                expectedRevision: freshWork.revision,
                sourceRevision: freshWork.sourceRevision,
                fields,
                confirmed: true,
                summary: freshWork.summary?.text ? freshWork.summary : {
                    text: `${fresh.symptom} (원인은 현장 점검 필요)`,
                    facts: [],
                    unknowns: ['정확한 원인은 현장 점검 필요'],
                    riskSignals: [],
                    limitations: [],
                    onsiteInspectionNeeded: true,
                },
            });
            await refreshRequest();
        }, '요약·분야를 재확정해 기사 후보를 불러왔어요.');
    }

    async function runCaseMatching() {
        if (!request || !work)
            return;
        await mutate(async () => {
            const fresh = await api.request(request.requestId) as Request;
            const freshWork = fresh.workItems.find(item => item.workItemId === work.workItemId);
            if (!freshWork?.sourceRevision)
                throw Error('작업 항목의 최신 근거 버전을 확인해 주세요.');
            const job = await api.aiJob(request.requestId, {
                type: 'CASE_MATCHING',
                workItemId: freshWork.workItemId,
                sourceRevision: freshWork.sourceRevision,
            }) as AiJob;
            setMatchJob(job);
        }, 'AI 사례 기반 기사 매칭을 요청했어요.');
    }

    function choose(expert: Technician) {
        if (!session)
            return navigate('login');
        setChosen(expert);
        setSelectedPhotos([]);
        setDelivery(null);
        setShareAcknowledged(false);
        setConfirmedReview(false);
    }

    async function prepare() {
        if (!request || !work || !chosen || !shareAcknowledged)
            return;
        await mutate(async () => {
            const fresh = await api.request(request.requestId) as Request;
            const freshWork: WorkItem | undefined = fresh.workItems.find(item => item.workItemId === work.workItemId);
            if (!freshWork?.sourceRevision) {
                throw Error('최신 작업 항목의 근거 버전을 확인할 수 없어요. 상세 화면을 새로고침해 주세요.');
            }
            const scope = {
                purpose: 'CONSULTATION',
                recipientTechnicianId: chosen.technicianId,
                consultationId: null,
                reservationId: null,
                photoIds: selectedPhotos,
                recordIds: [],
                questionIds: [],
                includeSummary: true,
                includeReport: false,
                includeQuoteContext: true,
            };
            const prepared = await api.post(`/work-items/${id(work.workItemId)}/deliveries`, { sourceRevision: freshWork.sourceRevision, scope, redactions: [] }, true) as Delivery;
            setDelivery(prepared);
            notice('상담용 자료를 준비하고 있어요. 완료되면 공개 범위를 확인해 주세요.');
        });
    }

    async function refreshDelivery() {
        if (!delivery)
            return;
        await mutate(async () => {
            setDelivery(await api.delivery(delivery.deliveryId) as Delivery);
        });
    }

    async function confirmAndRequest() {
        if (!chosen || !work || !delivery || delivery.status !== 'READY' || !confirmedReview)
            return;
        await mutate(async () => {
            const fresh = await api.delivery(delivery.deliveryId) as Delivery;
            if (fresh.status !== 'READY' || !fresh.content) {
                setDelivery(fresh);
                throw Error('최신 자료가 변경되었어요. 상담용 미리보기를 다시 확인해 주세요.');
            }
            if (!fresh.metadataRemoved) {
                throw Error('사진·파일 메타데이터 제거가 확인되지 않았어요. 전달을 중단했어요.');
            }
            await api.put(`/deliveries/${id(fresh.deliveryId)}/confirmation`, {
                expectedRevision: fresh.revision,
                sourceRevision: fresh.sourceRevision,
                confirmed: true,
            }, true);
            await api.post(`/work-items/${id(work.workItemId)}/consultations`, {
                technicianId: chosen.technicianId,
                deliveryId: fresh.deliveryId,
            }, true);
            setChosen(null);
            navigate('consultations');
        }, '상담 요청이 접수되었어요.');
    }

    function candidateCard(candidate: Candidate, evidence?: CaseRecommendation, excluded = false) {
        const expert = candidate.technician;
        if (!expert?.technicianId)
            return null;
        return <article className={`rx-card rx-candidate ${excluded ? 'rx-excluded' : ''}`} key={`${evidence ? 'case' : excluded ? 'excluded' : 'general'}-${expert.technicianId}`}>
            <div className="rx-inline" style={{ justifyContent: 'space-between' }}>
                <div className="rx-inline">
                    <span className="rx-detail-icon"><Icon name="tool" size={23}/></span>
                    <div>
                        <h3>{expert.displayName || '전문 기사'}</h3>
                        <p>{candidate.matchedFields?.map(fieldLabel).join(' · ') || '분야 확인 필요'}</p>
                    </div>
                </div>
                {evidence ? <Tag tone="sage">사례 추천 {evidence.rank}위</Tag> : excluded ? <Tag tone="rose">시간 불일치 제외</Tag> : <Tag>일반 후보</Tag>}
            </div>
            {evidence && <>
                <p>관련 사례 평균 {Number(evidence.averageScore).toFixed(1)}점 · {evidence.cases?.length || 0}개 사례</p>
                {evidence.cases?.map((c, i) => <div key={c.case?.caseId || i} className="rx-case-block">
                    <div className="rx-inline" style={{ justifyContent: 'space-between' }}>
                        <strong>{c.case?.content?.title || `연관 사례 ${i + 1}`}</strong>
                        <div className="rx-inline">
                            {c.case?.content?.dataType && <Tag tone="lavender">{statusLabel(c.case.content.dataType)}</Tag>}
                            <Tag tone="sage">{c.score}점</Tag>
                        </div>
                    </div>
                    {c.case?.content?.confirmedCause && <p>당시 확인 원인: <strong>{c.case.content.confirmedCause}</strong></p>}
                    {c.evidence?.map((line, j) => <p key={j} className="rx-candidate-evidence"><Icon name="check" size={15}/> {line}</p>)}
                    {(c.case?.beforePhotos?.[0] || c.case?.afterPhotos?.[0]) && <div className="rx-case-photos">
                        {c.case.beforePhotos?.[0] && <div className="rx-case-photo-card"><MediaImage mediaId={c.case.beforePhotos[0].mediaId} alt="수리 전 사례 사진"/><small>과거 사례 · 수리 전</small></div>}
                        {c.case.afterPhotos?.[0] && <div className="rx-case-photo-card"><MediaImage mediaId={c.case.afterPhotos[0].mediaId} alt="수리 후 사례 사진"/><small>과거 사례 · 수리 후</small></div>}
                    </div>}
                </div>)}
                <p className="rx-muted">과거 유사 사례 참고용이며, 현재 요청의 실제 원인은 현장 점검이 필요합니다.</p>
            </>}
            {!evidence && !excluded && <p>일반 후보예요. 유사 사례 점수를 부여하지 않아요.</p>}
            {candidate.timeFit && <div className="rx-inline">
                <Tag tone={candidate.timeFit === 'MATCHED' ? 'sage' : 'rose'}>{statusLabel(candidate.timeFit)}</Tag>
                {candidate.checks?.[0]?.reason && <span className="rx-muted">{candidate.checks[0].reason}</span>}
            </div>}
            <div className="rx-duo-buttons">
                <Button kind="outline" onClick={() => navigate('expert', expert.technicianId)}>공개 프로필</Button>
                <Button disabled={excluded} onClick={() => choose(expert)}>{excluded ? '일정 불일치' : '상담 자료 선택'}</Button>
            </div>
        </article>;
    }

    return <>
        <PageHeader title="우리 집 맞춤 기사" right={<button className="rx-iconbtn" onClick={() => { void refreshRequest(); void refreshCases(); void refreshGeneral(); void refreshInterests(); }}><Icon name="refresh"/></button>}/>
        <div className="rx-body rx-theme-sage">
            <h2 className="rx-page-title">관련 사례와 후보를 비교해요</h2>
            <p className="rx-lead">사례 기반 추천, 동선 참여 기사, 일반 후보를 구분해 보여줘요.</p>
            {loading ? <Spinner /> : error || !request ? <ErrorState message={error || '요청이 없습니다.'}/> : <>
                <section className="rx-card">
                    <div className="rx-inline">
                        <Tag tone="sage">작업 항목</Tag>
                        {work?.reviewStatus && <Tag tone={work.reviewStatus === 'CONFIRMED' ? 'sage' : 'rose'}>{statusLabel(work.reviewStatus)}</Tag>}
                        {work?.routeExplorationEnabled && <Tag tone="lavender">동선 탐색 중</Tag>}
                    </div>
                    <h3>{work?.summary?.text || request.symptom}</h3>
                    <p>{String(work?.facts?.part || '수리 위치 확인 필요')} · {String(work?.facts?.workType || '작업 종류 미입력')}</p>
                    {work && !isConfirmed && <div className="rx-case-block">
                        <strong>요약·분야 확인이 필요해요 ({statusLabel(work.reviewStatus || 'DRAFT')})</strong>
                        <p className="rx-muted">
                            작업 조건이나 제품 정보를 수정하면 최신 근거 기준으로 요약·분야를 다시 확정해야 기사 후보와 AI 사례 매칭이 표시돼요.
                        </p>
                        {work.facts?.fields?.length ? (
                            <Button disabled={busy} onClick={() => void reconfirmNow()}>현재 요약·분야로 바로 확정하고 후보 불러오기</Button>
                        ) : (
                            <Button kind="outline" onClick={() => navigate('detail', request.requestId)}>요청 상세에서 분야·요약 확인하기</Button>
                        )}
                    </div>}
                    {work && (!(work.facts?.visitPreference as any)?.ranges?.length && !(work.facts?.visitPreference as any)?.fixedStartAt || !work.facts?.workType) && (
                        <p className="rx-warn">
                            작업 종류 또는 방문 가능 구간이 비어 있으면 일정 적합성(시간 일치)이 확인되지 않아 AI 사례 매칭 추천에서 제외될 수 있어요. 아래 [작업·방문 조건 수정]에서 먼저 설정해 주세요.
                        </p>
                    )}
                    <div className="rx-duo-buttons">
                        <Button kind="secondary" disabled={busy || !work || !isConfirmed || ['QUEUED', 'RUNNING'].includes(matchJob?.status || '')} onClick={() => void runCaseMatching()}>
                            <Icon name="spark" size={16}/> {['QUEUED', 'RUNNING'].includes(matchJob?.status || '') ? 'AI 사례 매칭 중…' : 'AI 사례 매칭 실행'}
                        </Button>
                        <Button kind="outline" onClick={() => navigate('detail', request.requestId)}>작업·방문 조건 수정</Button>
                    </div>
                    {matchJob && ['FAILED', 'TIMED_OUT'].includes(matchJob.status) && <ErrorState message={matchJob.error?.message || 'AI 사례 매칭이 완료되지 않았어요. 일반 후보로 상담을 진행할 수 있어요.'}/>}
                </section>

                {(work?.routeExplorationEnabled || interestRows.length > 0) && <>
                    <h3 className="rx-section-caption">동선 제안 참여 의사 기사 ({interestRows.length}명)</h3>
                    {interestRows.length ? interestRows.map(row => <article className="rx-card rx-candidate" key={row.interestId}>
                        <div className="rx-inline" style={{ justifyContent: 'space-between' }}>
                            <div>
                                <h3>{row.technician.displayName}</h3>
                                <p>{row.technician.fields?.map(fieldLabel).join(' · ')} · {row.technician.regions?.map(r => r.neighborhood).join(', ')}</p>
                            </div>
                            <Tag tone="lavender">동선 참여 의사</Tag>
                        </div>
                        <p className="rx-muted">기사가 최소 작업 정보만 보고 참여 의사를 표시했어요. 상담 상대로 선택해 자료를 전달해야 견적을 받을 수 있어요.</p>
                        <div className="rx-duo-buttons">
                            <Button kind="outline" onClick={() => navigate('expert', row.technician.technicianId)}>공개 프로필</Button>
                            <Button onClick={() => choose(row.technician)}>상담 상대로 선택</Button>
                        </div>
                    </article>) : <Empty icon="map" title="아직 참여 의사를 표시한 기사가 없어요" detail="기사가 동선 추천에서 참여 의사를 표시하면 여기에 나타나요."/>}
                </>}

                <h3 className="rx-section-caption">관련 사례 기반 추천</h3>
                {!isConfirmed ? <Empty icon="search" title="요약·분야를 먼저 확정해 주세요" detail="위 카드에서 요약·분야를 확정하면 기사 후보와 AI 사례 매칭을 실행할 수 있어요."/> : casesError ? <ErrorState message={casesError} onRetry={() => void refreshCases()}/> : casesLoading || ['QUEUED', 'RUNNING'].includes(matchJob?.status || '') ? <Spinner text="과거 수리 사례를 대조하고 있어요"/> : scored.length ? scored.map(x => candidateCard(x.candidate, x)) :
                    <Empty icon="search" title="확인된 사례 추천이 없어요" detail={cases?.reason || '위 [AI 사례 매칭 실행] 버튼을 눌러 유사 수리 사례를 찾을 수 있어요.'}/>}

                <h3 className="rx-section-caption">일반 기사 후보</h3>
                {!isConfirmed ? <Empty icon="tool" title="요약·분야를 먼저 확정해 주세요" detail="확정이 완료되면 지역·분야에 맞는 기사 후보가 바로 표시돼요."/> : generalError ? <ErrorState message={generalError} onRetry={() => void refreshGeneral()}/> : generalLoading ? <Spinner /> : eligibleGeneral.length ? eligibleGeneral.map(x => candidateCard(x)) :
                    <Empty icon="tool" title="추가 일반 후보가 없어요" detail={scored.length ? '조건에 맞는 기사가 사례 추천 목록에 표시되고 있어요.' : '작업 지역·분야·방문 조건을 먼저 확인해 주세요.'}/>}

                {excludedGeneral.length > 0 && <>
                    <h3 className="rx-section-caption">방문 시간 불일치로 제외된 후보 ({excludedGeneral.length}명)</h3>
                    {excludedGeneral.map(x => candidateCard(x, undefined, true))}
                </>}

                <PrivacyNote>상담 전에 사용자가 공개할 자료를 선택하고, 메타데이터 제거 후 서버의 전달본을 다시 확인해요. AI 없이도 공개 프로필과 연락처로 직접 연락할 수 있어요.</PrivacyNote>
                <Button kind="outline" onClick={() => navigate('experts')}>접수 없이 전체 기사 찾기</Button>
            </>}
        </div>
        {chosen && <Modal title={`${chosen.displayName || '기사'}님에게 상담 요청`} onClose={() => setChosen(null)}>
            <div className="rx-form">
                <h3>기사에게 공유할 자료를 선택해 주세요</h3>
                <p>확인된 증상 요약과 견적 전제는 상담에 포함돼요. 사진은 직접 선택한 것만 공유돼요.</p>
                {!delivery && photos.some(p => (p.description || '').includes('레일')) && <div className="rx-chips">
                    <button type="button" onClick={() => {
                        const rail = photos.find(p => (p.description || '').includes('레일'));
                        if (rail)
                            setSelectedPhotos([rail.photoId]);
                    }}>시나리오 1: 레일 사진 1장만 선택</button>
                </div>}
                {photos.map((photo: Photo) => <label key={photo.photoId} className="rx-photo-consent">
                    <MediaImage photo={photo} className="rx-thumb"/>
                    <div>
                        <strong>{photo.description || '등록 사진'}</strong>
                        <p className="rx-muted">이 사진 공유</p>
                    </div>
                    <input type="checkbox" disabled={!!delivery} checked={selectedPhotos.includes(photo.photoId)} onChange={e => setSelectedPhotos(values => e.target.checked ? [...values, photo.photoId] : values.filter(x => x !== photo.photoId))}/>
                </label>)}
                {!delivery && <>
                    <label className="rx-check"><input type="checkbox" checked={shareAcknowledged} onChange={e => setShareAcknowledged(e.target.checked)}/> 위 정보가 선택한 기사에게 공개될 수 있음을 확인했어요.</label>
                    <Button disabled={busy || !shareAcknowledged} onClick={() => void prepare()}>선택 자료로 상담용 전달본 준비</Button>
                </>}
                {delivery && <>
                    <Tag tone={delivery.status === 'READY' ? 'sage' : 'rose'}>자료 준비 상태 · {statusLabel(delivery.status)}</Tag>
                    {delivery.error?.message && <ErrorState message={delivery.error.message}/>}
                    {delivery.status !== 'READY' && <Button kind="outline" onClick={() => void refreshDelivery()}>자료 준비 상태 새로고침</Button>}
                    {delivery.status === 'READY' && delivery.content && <>
                        <div className="rx-card">
                            <h3>전달될 자료 확인</h3>
                            <p>선택한 기사: {chosen.displayName}</p>
                            <p>선택 사진: {selectedPhotos.length}장 · 요약 및 견적 전제 포함</p>
                            <p>추가 문답·경과 기록·상세 방문 주소는 제외돼요.</p>
                            <p>메타데이터 제거: {delivery.metadataRemoved ? '완료' : '미확인'}</p>
                        </div>
                        <label className="rx-check"><input type="checkbox" checked={confirmedReview} onChange={e => setConfirmedReview(e.target.checked)}/> 위 공개 범위를 확인하고 상담 요청에 동의해요.</label>
                        <Button disabled={busy || !confirmedReview || !delivery.metadataRemoved} onClick={() => void confirmAndRequest()}>공개 범위 확정 후 상담 요청</Button>
                    </>}
                </>}
                <p className="rx-muted">자료·견적 전제가 부족하면 백엔드에서 요청을 거절할 수 있어요. 추가 상담은 공개 연락수단으로 진행돼요.</p>
            </div>
        </Modal>}
    </>;
}
