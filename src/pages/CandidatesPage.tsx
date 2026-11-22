import { useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useRemote } from '../hooks/useRemote';
import { Button, Empty, ErrorState, Field, Icon, MediaImage, Modal, PageHeader, PrivacyNote, Spinner, Tag } from '../components/UI';
import { allPhotos, fieldLabel, firstWork, id, itemsOf } from '../lib/format';
import type { Request, Technician, Photo, WorkItem } from '../types/models';
type Candidate = {
    technician: Technician;
    matchedFields?: string[];
    unsupportedFields?: string[];
    timeFit?: string;
    checks?: Array<{
        reason?: string;
        code?: string;
    }>;
};
type CaseRecommendation = {
    candidate: Candidate;
    rank: number;
    averageScore: number;
    cases?: Array<{
        score: number;
        evidence?: string[];
    }>;
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
    const { data: request, loading, error } = useRemote<Request>(() => api.request(requestId) as Promise<Request>, [requestId]);
    const work = request?.workItems.find(item => item.workItemId === workItemId) || firstWork(request);
    const { data: cases, loading: casesLoading } = useRemote<any>(() => work ? api.caseRecommendations(work.workItemId) : Promise.resolve(null), [work?.workItemId]);
    const { data: general, loading: generalLoading } = useRemote<any>(() => work ? api.generalCandidates(work.workItemId) : Promise.resolve(null), [work?.workItemId]);
    const [chosen, setChosen] = useState<Technician | null>(null);
    const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
    const [shareAcknowledged, setShareAcknowledged] = useState(false);
    const [delivery, setDelivery] = useState<Delivery | null>(null);
    const [confirmedReview, setConfirmedReview] = useState(false);
    const photos = allPhotos(request);
    const scored = Array.isArray(cases?.recommendations)
        ? cases.recommendations as CaseRecommendation[] : [];
    const unscored = itemsOf<Candidate>(general);
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
                includeQuoteContext: true
            };
            const prepared = await api.post(`/work-items/${id(work.workItemId)}/deliveries`, { sourceRevision: freshWork.sourceRevision, scope, redactions: [] }, true) as Delivery;
            setDelivery(prepared);
            notice('상담용 자료가 준비 중이에요. 서버에서 완료 상태를 확인해 주세요.');
        });
    }
    async function refreshDelivery() {
        if (!delivery)
            return;
        await mutate(async () => {
            setDelivery(await api.get(`/deliveries/${id(delivery.deliveryId)}`) as Delivery);
        });
    }
    async function confirmAndRequest() {
        if (!chosen || !work || !delivery || delivery.status !== 'READY' || !confirmedReview)
            return;
        await mutate(async () => {
            const fresh = await api.get(`/deliveries/${id(delivery.deliveryId)}`) as Delivery;
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
                confirmed: true
            }, true);
            await api.post(`/work-items/${id(work.workItemId)}/consultations`, {
                technicianId: chosen.technicianId,
                deliveryId: fresh.deliveryId
            }, true);
            setChosen(null);
            navigate('consultations');
        }, '상담 요청이 접수되었어요.');
    }
    function candidateCard(candidate: Candidate, evidence?: CaseRecommendation) {
        const expert = candidate.technician;
        if (!expert?.technicianId)
            return null;
        return <article className="rx-card rx-candidate" key={`${evidence ? 'case' : 'general'}-${expert.technicianId}`}>
      <div className="rx-inline" style={{ justifyContent: 'space-between' }}>
        <div className="rx-inline"><span className="rx-detail-icon"><Icon name="tool" size={23}/></span>
          <div><h3>{expert.displayName || '전문 기사'}</h3><p>{candidate.matchedFields?.map(fieldLabel).join(' · ') || '분야 확인 필요'}</p></div>
        </div>
        {evidence && <Tag tone="sage">사례 추천 {evidence.rank}위</Tag>}
      </div>
      {evidence && <p>관련 사례 평균 {Number(evidence.averageScore).toFixed(1)}점 · {evidence.cases?.length || 0}개 사례</p>}
      {evidence?.cases?.map((c, i) => <p key={i} className="rx-candidate-evidence">
        <Icon name="check" size={15}/> 사례 {i + 1} · {c.score}점 · {c.evidence?.join(' · ') || '근거 확인'}
      </p>)}
      {!evidence && <p>일반 후보예요. 유사 사례 점수를 부여하지 않아요.</p>}
      {candidate.timeFit && <Tag>{candidate.timeFit === 'UNKNOWN' ? '방문 가능 여부 미확인' : candidate.timeFit}</Tag>}
      <div className="rx-duo-buttons">
        <Button kind="outline" onClick={() => navigate('expert', expert.technicianId)}>공개 프로필</Button>
        <Button onClick={() => choose(expert)}>상담 자료 선택</Button>
      </div>
    </article>;
    }
    return <>
    <PageHeader title="우리 집 맞춤 기사"/>
    <div className="rx-body rx-theme-sage">
      <h2 className="rx-page-title">관련 사례를 보고 선택해요</h2>
      <p className="rx-lead">실제 서버가 확인한 추천과 일반 후보를 구분해 보여줘요.</p>
      {loading ? <Spinner /> : error || !request ? <ErrorState message={error || '요청이 없습니다.'}/> : <>
        <section className="rx-card"><Tag tone="sage">작업 항목</Tag>
          <h3>{work?.summary?.text || request.symptom}</h3>
          <p>{work?.facts?.part || '수리 위치 확인 필요'}</p>
        </section>
        <h3 className="rx-section-caption">관련 사례 기반 추천</h3>
        {casesLoading ? <Spinner /> : scored.length ? scored.map(x => candidateCard(x.candidate, x)) :
                <Empty icon="search" title="확인된 사례 추천이 없어요" detail={cases?.reason || '관련 사례가 부족하거나 추천을 준비 중이에요.'}/>}
        <h3 className="rx-section-caption">일반 기사 후보</h3>
        {generalLoading ? <Spinner /> : unscored.length ? unscored.map(x => candidateCard(x)) :
                <Empty icon="tool" title="현재 조건의 후보가 없어요" detail="필요한 분야·지역·일정을 먼저 확인해 주세요."/>}
        <PrivacyNote>상담 전에 사용자가 공개할 자료를 선택하고, 가림 처리 후 서버의 전달본을 다시 확인해요. AI 없이도 공개 프로필과 연락처로 직접 연락할 수 있어요.</PrivacyNote>
        <Button kind="outline" onClick={() => navigate('experts')}>접수 없이 전체 기사 찾기</Button>
      </>}
    </div>
    {chosen && <Modal title={`${chosen.displayName || '기사'}님에게 상담 요청`} onClose={() => setChosen(null)}>
      <div className="rx-form">
        <h3>기사에게 공유할 자료를 선택해 주세요</h3>
        <p>확인된 증상 요약과 견적에 필요한 기본 정보는 상담에 포함돼요. 사진은 직접 선택한 것만 공유해요.</p>
        {photos.map((photo: Photo) => <label key={photo.photoId} className="rx-photo-consent">
          <MediaImage photo={photo} className="rx-thumb"/>
          <input type="checkbox" disabled={!!delivery} checked={selectedPhotos.includes(photo.photoId)} onChange={e => setSelectedPhotos(values => e.target.checked ? [...values, photo.photoId] : values.filter(x => x !== photo.photoId))}/>
          <span>이 사진 공유</span>
        </label>)}
        {!delivery && <>
          <label className="rx-check"><input type="checkbox" checked={shareAcknowledged} onChange={e => setShareAcknowledged(e.target.checked)}/> 위 정보가 선택한 기사에게 공개될 수 있음을 확인했어요.</label>
          <Button disabled={busy || !shareAcknowledged} onClick={() => void prepare()}>선택 자료로 상담용 전달본 준비</Button>
        </>}
        {delivery && <>
          <Tag tone={delivery.status === 'READY' ? 'sage' : 'rose'}>자료 준비 상태 · {delivery.status}</Tag>
          {delivery.error?.message && <ErrorState message={delivery.error.message}/>}
          <Button kind="outline" onClick={() => void refreshDelivery()}>자료 준비 상태 새로고침</Button>
          {delivery.status === 'READY' && delivery.content && <>
            <div className="rx-card">
              <h3>전달될 자료 확인</h3>
              <p>선택한 기사: {chosen.displayName}</p>
              <p>사진: {selectedPhotos.length}장 · 요약 및 견적 전제 포함</p>
              <p>추가 문답·경과 기록·상세 방문 주소는 선택하지 않았어요.</p>
              <p>메타데이터 제거: {delivery.metadataRemoved ? '완료' : '미확인'}</p>
            </div>
            <label className="rx-check"><input type="checkbox" checked={confirmedReview} onChange={e => setConfirmedReview(e.target.checked)}/> 위 공개 범위를 확인하고 상담 요청에 동의해요.</label>
            <Button disabled={busy || !confirmedReview || !delivery.metadataRemoved} onClick={() => void confirmAndRequest()}>공개 범위 확정 후 상담 요청</Button>
          </>}
        </>}
        <p className="rx-muted">자료·견적 전제가 부족하면 백엔드에서 요청을 거절할 수 있어요. 이 화면은 권한·지역 검증을 우회하지 않아요.</p>
      </div>
    </Modal>}
  </>;
}
