import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useRemote } from '../hooks/useRemote';
import { PageHeader, Spinner, ErrorState, Icon, Button, Field, Tag, PrivacyNote, MediaImage } from '../components/UI';
import { firstWork, id, allPhotos, itemsOf } from '../lib/format';
import type { Request, Photo } from '../types/models';
export default function ReportPage() {
    const { route, mutate, busy, notice } = useApp();
    const { data: request, loading, error } = useRemote<Request>(() => api.request(route.id!) as Promise<Request>, [route.id]);
    const work = firstWork(request);
    const { data: report, setData: setReport, error: reportError, refresh } = useRemote<any>(() => work ? api.get(`/work-items/${id(work.workItemId)}/report`).catch((e: any) => { if (e.status === 404)
        return null; throw e; }) : Promise.resolve(null), [work?.workItemId]);
    const { data: deliveries, refresh: refreshDeliveries } = useRemote<any>(() => work ? api.get(`/work-items/${id(work.workItemId)}/deliveries`) : Promise.resolve([]), [work?.workItemId]);
    const [markdown, setMarkdown] = useState(''), [selected, setSelected] = useState<string[]>([]), [pdfJobs, setPdfJobs] = useState<Record<string, any>>({});
    useEffect(() => { setMarkdown(report?.draft?.content?.markdown || report?.current?.content?.markdown || ''); setSelected(report?.draft?.content?.photoIds || report?.current?.content?.photoIds || []); }, [report?.revision]);
    async function save() { if (!work || !request || !markdown.trim())
        return; await mutate(async () => { const current = await api.get(`/work-items/${id(work.workItemId)}/report`).catch((e: any) => e.status === 404 ? null : Promise.reject(e)); await api.put(`/work-items/${id(work.workItemId)}/report`, { expectedRevision: current?.revision || null, sourceRevision: work.sourceRevision, report: { markdown, photoIds: selected, facts: [], unknowns: [] } }); await refresh(); }, '보고서 초안을 저장했어요.'); }
    async function confirm() { if (!work || !report)
        return; await mutate(async () => { await api.put(`/work-items/${id(work.workItemId)}/report/confirmation`, { expectedRevision: report.revision, sourceRevision: report.sourceRevision, confirmed: true }, true); await refresh(); }, '보고서 내용을 확인했어요.'); }
    async function createPdfDelivery() { if (!work || !request || report?.reviewStatus !== 'CONFIRMED')
        return notice('먼저 보고서를 확인해 주세요.', 'error'); await mutate(async () => { const delivery = await api.post(`/work-items/${id(work.workItemId)}/deliveries`, { sourceRevision: work.sourceRevision, scope: { purpose: 'EXTERNAL_PDF', recipientTechnicianId: null, consultationId: null, reservationId: null, photoIds: selected, recordIds: [], questionIds: [], includeSummary: true, includeReport: true, includeQuoteContext: false }, redactions: [] }, true); await refreshDeliveries(); notice(`PDF 전달본 준비를 접수했어요. 처리 상태: ${delivery.status}`); }, '전달본 준비를 요청했어요.'); }
    async function confirmDelivery(d: any) { if (!window.confirm('이 자료의 공유 범위와 내용, 사진 및 가림 결과를 확인했나요?'))
        return; await mutate(async () => { const latest = await api.get(`/deliveries/${id(d.deliveryId)}`); if (latest.status !== 'READY' || !latest.content || !latest.metadataRemoved)
        throw Error('전달본 준비 완료 및 메타데이터 제거를 확인해야 해요.'); await api.put(`/deliveries/${id(latest.deliveryId)}/confirmation`, { expectedRevision: latest.revision, sourceRevision: latest.sourceRevision, confirmed: true }, true); await refreshDeliveries(); }, '전달본의 공개 내용을 확인했어요.'); }
    async function pdfAction(d: any) { await mutate(async () => { const current = await api.get(`/deliveries/${id(d.deliveryId)}`); if (current.reviewStatus !== 'CONFIRMED')
        throw Error('전달본의 공개 범위를 먼저 확인해 주세요.'); const job = await api.post(`/deliveries/${id(d.deliveryId)}/pdf-jobs`, { deliveryRevision: current.revision }, true); setPdfJobs(x => ({ ...x, [d.deliveryId]: job })); }, 'PDF 생성 작업을 접수했어요.'); }
    async function checkPdf(jobId: string) { await mutate(async () => { const job = await api.get(`/pdf-jobs/${id(jobId)}`); if (job.status === 'SUCCEEDED') {
        const blob = await api.blob(`/pdf-jobs/${id(jobId)}/content`) as Blob;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = '고쳐야집-인계보고서.pdf';
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    else
        notice(`PDF 작업 상태: ${job.status}`); }); }
    if (loading)
        return <><PageHeader title="인계 보고서"/><Spinner /></>;
    if (error || !work)
        return <><PageHeader title="인계 보고서"/><ErrorState message={error || '작업 항목이 없어요.'}/></>;
    return <><PageHeader title="인계 보고서"/><div className="rx-body"><div className="rx-overline">HANDOVER REPORT</div><h2 className="rx-page-title">우리 집 경과 보고서</h2><p className="rx-lead">관찰한 사실과 미확인 정보를 나눠 정리해요.</p>{reportError && <ErrorState message={reportError}/>}<div className="rx-card"><Tag tone="sage">{report?.reviewStatus || '초안 미작성'}</Tag><h3>문서 미리보기</h3><div className="rx-document"><pre>{markdown || '아직 작성한 보고서가 없어요.'}</pre></div><div className="rx-form"><Field label="보고서 Markdown 본문"><textarea rows={8} value={markdown} onChange={e => setMarkdown(e.target.value)} placeholder="발견 부위·날짜·관찰·조치·미확인 사항을 구분해서 작성해 주세요."/></Field><strong>함께 포함할 사진</strong><div className="rx-photo-list">{allPhotos(request).map((p: Photo) => <label key={p.photoId} className="rx-photo-choice"><MediaImage photo={p}/><input type="checkbox" checked={selected.includes(p.photoId)} onChange={e => setSelected(s => e.target.checked ? [...s, p.photoId] : s.filter(x => x !== p.photoId))}/></label>)}</div><Button disabled={!markdown.trim() || busy} onClick={() => void save()}>초안 저장</Button>{report?.revision && <Button kind="outline" disabled={busy} onClick={() => void confirm()}>본문·사진 확인 완료</Button>}</div></div><section className="rx-card"><h3>외부 PDF 전달본</h3><p>전달 대상 사진과 본문은 사용자가 최종 확인해야 해요.</p><Button kind="secondary" disabled={busy || report?.reviewStatus !== 'CONFIRMED'} onClick={() => void createPdfDelivery()}>외부 PDF 전달본 준비</Button>{itemsOf<any>(deliveries).map((d: any) => <div key={d.deliveryId} className="rx-mini-card"><p>전달본 {d.status} · {d.reviewStatus}</p>{d.status === 'READY' && d.reviewStatus !== 'CONFIRMED' && <Button kind="outline" onClick={() => void confirmDelivery(d)}>공개 범위 확인</Button>}<Button kind="outline" onClick={() => void pdfAction(d)} disabled={d.reviewStatus !== 'CONFIRMED'}>PDF 생성</Button>{pdfJobs[d.deliveryId] && <button className="rx-link" onClick={() => void checkPdf(pdfJobs[d.deliveryId].jobId)}>PDF 상태 확인·다운로드</button>}</div>)}</section><PrivacyNote>가림·공개 범위를 확인하지 않은 전달본은 외부로 제공하지 않아요. 자료 삭제 시 과거 보고서가 무효화될 수 있어요.</PrivacyNote></div></>;
}
