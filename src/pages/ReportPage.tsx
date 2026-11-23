import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useRemote } from '../hooks/useRemote';
import { PageHeader, Spinner, ErrorState, Icon, Button, Field, Tag, PrivacyNote, MediaImage, AnnotatedPhoto, MarkdownView, type RegionBox } from '../components/UI';
import { firstWork, id, allPhotos, itemsOf, day, statusLabel } from '../lib/format';
import type { AiJob, Request, Photo, Reservation } from '../types/models';
export default function ReportPage() {
    const { route, mutate, busy, notice } = useApp();
    const { data: request, loading, error, refresh: refreshRequest } = useRemote<Request>(() => api.request(route.id!) as Promise<Request>, [route.id]);
    const work = firstWork(request);
    const { data: report, error: reportError, refresh } = useRemote<any>(() => work ? api.get(`/work-items/${id(work.workItemId)}/report`).catch((e: any) => {
        if (e.status === 404)
            return null;
        throw e;
    }) : Promise.resolve(null), [work?.workItemId]);
    const { data: deliveries, refresh: refreshDeliveries } = useRemote<any>(() => work ? api.deliveryList(work.workItemId) : Promise.resolve([]), [work?.workItemId]);
    const { data: activeReservation } = useRemote<Reservation | null>(() => work?.activeReservationId ? api.get(`/reservations/${id(work.activeReservationId)}`).catch(() => null) : Promise.resolve(null), [work?.activeReservationId]);

    const [markdown, setMarkdown] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const [facts, setFacts] = useState<any[]>([]);
    const [unknowns, setUnknowns] = useState<string[]>([]);
    const [draftJob, setDraftJob] = useState<AiJob | null>(null);
    const [pdfJobs, setPdfJobs] = useState<Record<string, any>>({});

    const photos = allPhotos(request);
    const activeReportContent = report?.draft || report?.current || null;
    const deliveryRows = itemsOf<any>(deliveries);
    const externalDeliveries = deliveryRows.filter((d: any) => d.scope?.purpose === 'EXTERNAL_PDF');
    const handoverDeliveries = deliveryRows.filter((d: any) => d.scope?.purpose === 'HANDOVER');

    useEffect(() => {
        const body = report?.draft?.content || report?.current?.content;
        if (body) {
            setMarkdown(body.markdown || '');
            setSelected(body.photoIds || []);
            setFacts(body.facts || []);
            setUnknowns(body.unknowns || []);
        }
        else if (!markdown && request && photos.length) {
            const first = photos[0];
            const last = photos[photos.length - 1];
            setSelected(first && last && first.photoId !== last.photoId ? [first.photoId, last.photoId] : photos.map(p => p.photoId));
        }
    }, [report?.revision, request?.requestId]);

    useEffect(() => {
        if (!draftJob || !['QUEUED', 'RUNNING'].includes(draftJob.status))
            return;
        let alive = true;
        const timer = window.setInterval(() => {
            void api.aiStatus(draftJob.jobId).then((j: AiJob) => {
                if (!alive)
                    return;
                setDraftJob(j);
                if (j.status === 'SUCCEEDED' && j.result?.reportDraft) {
                    const draft = j.result.reportDraft;
                    setMarkdown(draft.markdown || '');
                    setSelected(draft.photoIds || []);
                    setFacts(draft.facts || []);
                    setUnknowns(draft.unknowns || []);
                    notice('AI 보고서 초안을 불러왔어요. 내용을 확인·수정하고 저장해 주세요.');
                }
            }).catch(() => { });
        }, 1500);
        return () => { alive = false; window.clearInterval(timer); };
    }, [draftJob?.jobId, draftJob?.status, notice]);

    useEffect(() => {
        const hasPendingDelivery = deliveryRows.some((d: any) => ['QUEUED', 'PROCESSING'].includes(d.status));
        if (!hasPendingDelivery)
            return;
        const timer = window.setInterval(() => { void refreshDeliveries(); }, 1500);
        return () => window.clearInterval(timer);
    }, [deliveryRows.map((d: any) => `${d.deliveryId}:${d.status}`).join(','), refreshDeliveries]);

    useEffect(() => {
        const pendingPdf = Object.entries(pdfJobs).filter(([, j]) => ['QUEUED', 'PROCESSING'].includes(j?.status));
        if (!pendingPdf.length)
            return;
        let alive = true;
        const timer = window.setInterval(() => {
            void Promise.allSettled(pendingPdf.map(([did, j]) => api.get(`/pdf-jobs/${id(j.jobId)}`).then(updated => [did, updated]))).then(results => {
                if (!alive)
                    return;
                setPdfJobs(prev => {
                    const next = { ...prev };
                    for (const res of results) {
                        if (res.status === 'fulfilled') {
                            const [did, updated] = res.value as [string, any];
                            next[did] = updated;
                        }
                    }
                    return next;
                });
            });
        }, 1500);
        return () => { alive = false; window.clearInterval(timer); };
    }, [JSON.stringify(pdfJobs)]);

    async function runAiDraft() {
        if (!request || !work)
            return;
        await mutate(async () => {
            const fresh = await api.request(request.requestId) as Request;
            const freshWork = firstWork(fresh);
            if (!freshWork?.sourceRevision)
                throw Error('작업 항목 근거 버전을 확인해 주세요.');
            const job = await api.aiJob(request.requestId, {
                type: 'REPORT_DRAFT',
                workItemId: freshWork.workItemId,
                sourceRevision: freshWork.sourceRevision,
            }) as AiJob;
            setDraftJob(job);
        }, 'AI 보고서 초안 생성을 요청했어요.');
    }

    async function save() {
        if (!work || !request || !markdown.trim())
            return;
        await mutate(async () => {
            const fresh = await api.request(request.requestId) as Request;
            const freshWork = firstWork(fresh)!;
            const current = await api.get(`/work-items/${id(freshWork.workItemId)}/report`).catch((e: any) => e.status === 404 ? null : Promise.reject(e));
            await api.put(`/work-items/${id(freshWork.workItemId)}/report`, {
                expectedRevision: current?.revision || null,
                sourceRevision: freshWork.sourceRevision,
                report: { markdown, photoIds: selected, facts, unknowns },
            });
            await refresh();
            await refreshRequest();
        }, '보고서 초안을 저장했어요.');
    }

    async function confirm() {
        if (!work || !report)
            return;
        await mutate(async () => {
            await api.put(`/work-items/${id(work.workItemId)}/report/confirmation`, {
                expectedRevision: report.revision,
                sourceRevision: report.sourceRevision,
                confirmed: true,
            }, true);
            await refresh();
        }, '보고서 본문과 연결 사진을 확정했어요.');
    }

    async function createDelivery(purpose: 'EXTERNAL_PDF' | 'HANDOVER') {
        if (!work || !request || report?.reviewStatus !== 'CONFIRMED')
            return notice('먼저 보고서를 확정해 주세요.', 'error');
        if (purpose === 'HANDOVER' && !activeReservation)
            return notice('확정된 예약이 있어야 기사에게 인계서를 전달할 수 있어요.', 'error');
        await mutate(async () => {
            const fresh = await api.request(request.requestId) as Request;
            const freshWork = firstWork(fresh)!;
            const reportPhotos = report?.current?.content?.photoIds || selected;
            const scope = purpose === 'EXTERNAL_PDF'
                ? { purpose: 'EXTERNAL_PDF', recipientTechnicianId: null, consultationId: null, reservationId: null, photoIds: reportPhotos, recordIds: [], questionIds: [], includeSummary: false, includeReport: true, includeQuoteContext: false }
                : { purpose: 'HANDOVER', recipientTechnicianId: activeReservation!.technicianId, consultationId: null, reservationId: activeReservation!.reservationId, photoIds: reportPhotos, recordIds: [], questionIds: [], includeSummary: false, includeReport: true, includeQuoteContext: false };
            const delivery = await api.post(`/work-items/${id(freshWork.workItemId)}/deliveries`, {
                sourceRevision: freshWork.sourceRevision,
                scope,
                redactions: [],
            }, true);
            await refreshDeliveries();
            notice(`${purpose === 'EXTERNAL_PDF' ? '집주인 공유용 PDF' : '확정 기사 인계용'} 전달본을 준비 중이에요. (${statusLabel(delivery.status)})`);
        });
    }

    async function confirmDelivery(d: any) {
        if (!window.confirm('이 자료의 공개 범위·사진·메타데이터 제거 결과를 확인했나요?'))
            return;
        await mutate(async () => {
            const latest = await api.delivery(d.deliveryId);
            if (latest.status !== 'READY' || !latest.content || !latest.metadataRemoved)
                throw Error('전달본 준비 완료 및 메타데이터 제거를 확인해야 해요.');
            await api.put(`/deliveries/${id(latest.deliveryId)}/confirmation`, {
                expectedRevision: latest.revision,
                sourceRevision: latest.sourceRevision,
                confirmed: true,
            }, true);
            await refreshDeliveries();
        }, '전달본의 공개 범위를 확정했어요.');
    }

    async function pdfAction(d: any) {
        await mutate(async () => {
            const current = await api.delivery(d.deliveryId);
            if (current.reviewStatus !== 'CONFIRMED')
                throw Error('전달본의 공개 범위를 먼저 확인해 주세요.');
            const job = await api.post(`/deliveries/${id(d.deliveryId)}/pdf-jobs`, { deliveryRevision: current.revision }, true);
            setPdfJobs(x => ({ ...x, [d.deliveryId]: job }));
        }, 'PDF 생성 작업을 접수했어요.');
    }

    async function downloadPdf(jobId: string) {
        await mutate(async () => {
            const job = await api.get(`/pdf-jobs/${id(jobId)}`);
            if (job.status === 'READY' && job.downloadAvailable) {
                const blob = await api.blob(`/pdf-jobs/${id(jobId)}/content`) as Blob;
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = '고쳐야집-경과보고서.pdf';
                link.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 4000);
            }
            else {
                notice(`PDF 작업 상태: ${statusLabel(job.status)}`, job.status === 'FAILED' ? 'error' : 'success');
            }
        });
    }

    if (loading)
        return <><PageHeader title="인계 보고서"/><Spinner /></>;
    if (error || !work)
        return <><PageHeader title="인계 보고서"/><ErrorState message={error || '작업 항목이 없어요.'}/></>;

    return <><PageHeader title="인계 보고서" right={<button className="rx-iconbtn" onClick={() => { void refresh(); void refreshDeliveries(); }}><Icon name="refresh"/></button>}/>
        <div className="rx-body">
            <div className="rx-overline">HANDOVER REPORT</div>
            <h2 className="rx-page-title">우리 집 경과 보고서</h2>
            <p className="rx-lead">관찰 사실·사용자 기록·원인 미확인을 구분해 집주인과 기사에게 공유해요.</p>
            {reportError && <ErrorState message={reportError}/>}

            <div className="rx-card">
                <div className="rx-inline" style={{ justifyContent: 'space-between' }}>
                    <Tag tone={report?.reviewStatus === 'CONFIRMED' ? 'sage' : 'rose'}>{report?.reviewStatus ? statusLabel(report.reviewStatus) : '초안 미작성'}</Tag>
                    <Button kind="secondary" disabled={busy || ['QUEUED', 'RUNNING'].includes(draftJob?.status || '')} onClick={() => void runAiDraft()}>
                        <Icon name="spark" size={15}/> {['QUEUED', 'RUNNING'].includes(draftJob?.status || '') ? '초안 생성 중…' : 'AI 보고서 초안 생성'}
                    </Button>
                </div>
                {draftJob && ['FAILED', 'TIMED_OUT'].includes(draftJob.status) && <ErrorState message={draftJob.error?.message || 'AI 초안을 생성하지 못했어요. 직접 작성할 수 있어요.'}/>}
                <h3>보고서 미리보기</h3>
                <div className="rx-document">
                    <MarkdownView markdown={markdown}/>
                </div>
                {activeReportContent?.photos?.length > 0 && <div className="rx-compare-grid">
                    {activeReportContent.photos.map((p: any) => <AnnotatedPhoto
                        key={p.photoId}
                        mediaId={p.media?.mediaId}
                        regions={(p.regions || []) as RegionBox[]}
                        caption={`촬영일: ${p.capturedOn ? day(p.capturedOn) : '미확인'} · ${p.observation || ''}`}
                    />)}
                </div>}
                <div className="rx-form">
                    <div className="rx-chips">
                        <button type="button" onClick={() => {
                            const ordered = [...photos].sort((a, b) => (a.capturedOn || '').localeCompare(b.capturedOn || ''));
                            const d1 = ordered[0]?.capturedOn ? day(ordered[0].capturedOn) : '1일차';
                            const d3 = ordered[1]?.capturedOn ? day(ordered[1].capturedOn) : '3일차';
                            const d4 = ordered[2]?.capturedOn ? day(ordered[2].capturedOn) : '4일차';
                            setMarkdown([
                                '# 거실 창문 왼쪽 아래 벽지 물자국 경과 보고서',
                                '',
                                '## 관찰 사실',
                                `- ${d4} 사진에서 물자국이 아래쪽으로 넓게 보임. (${d1} 기준 사진과 비교)`,
                                '',
                                '## 사용자 기록',
                                `- ${d3}에 비가 왔고 환기 후에도 자국이 남았다고 사용자가 기록함.`,
                                '',
                                '## 미확인 사항',
                                '- 내부 누수·결로 등 정확한 원인은 현장 확인 필요.',
                            ].join('\n'));
                            if (ordered.length >= 3) {
                                setSelected([ordered[0].photoId, ordered[2].photoId]);
                            }
                            else if (ordered.length > 0) {
                                setSelected(ordered.map(p => p.photoId));
                            }
                        }}>시나리오 3 보고서 예시·사진(1일차·4일차) 채우기</button>
                    </div>
                    <Field label="보고서 Markdown 본문">
                        <textarea rows={7} value={markdown} onChange={e => setMarkdown(e.target.value)} placeholder="예) 19일 사진에서 물자국이 아래쪽으로 넓게 보임. 18일에 비가 왔고 환기 후에도 자국이 남았다고 사용자가 기록함. 원인은 현장 확인 필요."/>
                    </Field>
                    <strong>연결할 원본 사진 (촬영일 포함)</strong>
                    <div className="rx-photo-list">
                        {photos.map((p: Photo) => <label key={p.photoId} className="rx-photo-choice">
                            <MediaImage photo={p} className="rx-photo-tile"/>
                            <small>{p.capturedOn ? day(p.capturedOn) : '미확인'}</small>
                            <input type="checkbox" checked={selected.includes(p.photoId)} onChange={e => setSelected(s => e.target.checked ? [...s, p.photoId] : s.filter(x => x !== p.photoId))}/>
                        </label>)}
                    </div>
                    <div className="rx-duo-buttons">
                        <Button disabled={!markdown.trim() || busy} onClick={() => void save()}>초안 저장</Button>
                        {report?.revision && <Button kind="outline" disabled={busy || report.reviewStatus === 'CONFIRMED'} onClick={() => void confirm()}>본문·사진 확정</Button>}
                    </div>
                </div>
            </div>

            <section className="rx-card">
                <h3>집주인·관리사무소 공유용 PDF</h3>
                <p>상세 주소·연락처·견적을 제외하고 확인한 사진과 경과만 담긴 PDF를 내려받아요.</p>
                <Button kind="secondary" disabled={busy || report?.reviewStatus !== 'CONFIRMED'} onClick={() => void createDelivery('EXTERNAL_PDF')}>외부 PDF 전달본 준비</Button>
                {externalDeliveries.map((d: any) => {
                    const job = pdfJobs[d.deliveryId];
                    return <div key={d.deliveryId} className="rx-mini-card">
                        <div className="rx-inline">
                            <Tag tone={d.status === 'READY' ? 'sage' : 'rose'}>{statusLabel(d.status)}</Tag>
                            <Tag tone={d.reviewStatus === 'CONFIRMED' ? 'sage' : 'rose'}>{statusLabel(d.reviewStatus)}</Tag>
                        </div>
                        <div className="rx-duo-buttons">
                            {d.status === 'READY' && d.reviewStatus !== 'CONFIRMED' && <Button kind="outline" disabled={busy} onClick={() => void confirmDelivery(d)}>공개 범위 확인</Button>}
                            <Button kind="outline" disabled={busy || d.reviewStatus !== 'CONFIRMED'} onClick={() => void pdfAction(d)}>PDF 생성</Button>
                        </div>
                        {job && <div className="rx-inline">
                            <Tag tone={job.status === 'READY' ? 'sage' : 'rose'}>PDF · {statusLabel(job.status)}</Tag>
                            <button className="rx-link" onClick={() => void downloadPdf(job.jobId)}>
                                <Icon name="download" size={15}/> {job.status === 'READY' && job.downloadAvailable ? 'PDF 다운로드' : '상태 다시 확인'}
                            </button>
                        </div>}
                    </div>;
                })}
            </section>

            <section className="rx-card">
                <h3>확정 기사 사전 인계서 전달</h3>
                {activeReservation ? <>
                    <p>예약이 확정된 담당 기사에게 확인된 인계 보고서와 근거 사진을 전달해요.</p>
                    <Button kind="secondary" disabled={busy || report?.reviewStatus !== 'CONFIRMED'} onClick={() => void createDelivery('HANDOVER')}>확정 기사 인계 전달본 준비</Button>
                    {handoverDeliveries.map((d: any) => <div key={d.deliveryId} className="rx-mini-card">
                        <div className="rx-inline">
                            <Tag tone={d.status === 'READY' ? 'sage' : 'rose'}>{statusLabel(d.status)}</Tag>
                            <Tag tone={d.reviewStatus === 'CONFIRMED' ? 'sage' : 'rose'}>{statusLabel(d.reviewStatus)}</Tag>
                        </div>
                        {d.status === 'READY' && d.reviewStatus !== 'CONFIRMED' && <Button kind="outline" disabled={busy} onClick={() => void confirmDelivery(d)}>인계 공개 범위 확정</Button>}
                        {d.reviewStatus === 'CONFIRMED' && <p className="rx-muted">담당 기사가 예약 상세 화면에서 이 인계서를 열람할 수 있어요.</p>}
                    </div>)}
                </> : <p className="rx-muted">예약이 확정된 뒤에 담당 기사에게 사전 인계서를 전달할 수 있어요.</p>}
            </section>

            <PrivacyNote>공개 범위를 확인하지 않은 전달본은 외부 PDF나 기사에게 제공하지 않아요. 원본 사진 수정·삭제 시 이전 PDF는 자동으로 무효화돼요.</PrivacyNote>
        </div></>;
}
