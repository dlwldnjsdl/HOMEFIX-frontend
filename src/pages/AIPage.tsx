import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { useRemote } from '../hooks/useRemote';
import { PageHeader, Spinner, ErrorState, Icon, Button, Tag, Field, PrivacyNote } from '../components/UI';
import { fieldCodes, fieldLabel, firstWork, id } from '../lib/format';
import type { AiJob, Request, WorkItem } from '../types/models';
export default function AIPage() {
    const { route, navigate, mutate, busy, notice } = useApp();
    const { data: request, loading, error, refresh } = useRemote<Request>(() => api.request(route.id!) as Promise<Request>, [route.id]);
    const [job, setJob] = useState<AiJob | null>(null), [answer, setAnswer] = useState(''), [field, setField] = useState('PLUMBING'), [summary, setSummary] = useState('');
    const [summarySource, setSummarySource] = useState<any>(null);
    const work = firstWork(request);
    const questions = request?.dialogue?.questions || [];
    const pending = questions.find((q: any) => !q.answer && !q.optionId && !q.skipped);
    useEffect(() => { if (!job || !['QUEUED', 'RUNNING', 'PENDING', 'PROCESSING'].includes(job.status))
        return; let alive = true; const timer = window.setInterval(() => { void api.aiStatus(job.jobId).then((j: AiJob) => { if (alive)
        setJob(j); }).catch(() => { }); }, 2000); return () => { alive = false; window.clearInterval(timer); }; }, [job?.jobId, job?.status]);
    useEffect(() => { if (job?.status === 'SUCCEEDED' && job.result?.summary) {
        const x = job.result.summary;
        setSummarySource(x);
        setSummary(x.text || '');
        setField(job.result.fieldCandidates?.[0] || work?.facts?.fields?.[0] || 'PLUMBING');
    } }, [job?.jobId, job?.status]);
    async function run(type: 'DIAGNOSIS' | 'QUESTION', retry = false) { if (!request || !work)
        return; await mutate(async () => { const body = type === 'DIAGNOSIS' ? { type, workItemId: work.workItemId, sourceRevision: work.sourceRevision, ...(retry && job ? { retryOfJobId: job.jobId } : {}) } : { type, sourceRevision: request.sourceRevision, ...(retry && job ? { retryOfJobId: job.jobId } : {}) }; const result = await api.aiJob(request.requestId, body) as AiJob; setJob(result); }, 'AI 요청을 접수했어요.'); }
    async function dialogue(action: 'ANSWER' | 'SKIP' | 'FINISH', optionId?: string) { if (!request)
        return; await mutate(async () => { const payload: any = { expectedRevision: request.dialogue?.revision, action }; if (action !== 'FINISH')
        payload.questionId = pending?.questionId; if (action === 'ANSWER') {
        if (optionId)
            payload.optionId = optionId;
        else
            payload.answer = answer;
    } await api.aiAnswer(request.requestId, payload); setAnswer(''); await refresh(); }, '답변을 저장했어요.'); }
    async function confirm() { if (!request || !work || !summary.trim())
        return notice('요약 내용을 확인해 주세요.', 'error'); await mutate(async () => { await api.confirmWork(work.workItemId, { sourceRevision: work.sourceRevision, expectedRevision: work.revision, summary: { ...summarySource, text: summary }, fields: [field], confirmed: true }); await refresh(); navigate('solutions', request.requestId); }, '확인한 요약을 저장했어요.'); }
    if (loading)
        return <><PageHeader title="고쳐야집 AI 상담"/><Spinner /></>;
    if (error || !request)
        return <><PageHeader title="고쳐야집 AI 상담"/><ErrorState message={error || '요청을 찾을 수 없어요.'}/></>;
    return <><PageHeader title="고쳐야집 AI 상담"/><div className="rx-body rx-ai"><div className="rx-ai-welcome"><span className="rx-ai-orbit"><Icon name="spark" size={27}/></span><div><span className="rx-overline">AI HOMECARE</span><h2>우리 집 문제를 함께 살펴봐요</h2><p>분석은 직접 실행할 때만 시작돼요.</p></div></div><div className="rx-bubble user"><p>{request.symptom}</p></div><div className="rx-bubble agent"><p>사진과 설명을 바탕으로 가능한 원인을 알아보고, 필요한 경우 최대 5회 질문할게요. 확정 진단은 아니에요.</p></div>
    {work?.summary && <div className="rx-card"><Tag tone="sage">사용자 확인된 증상</Tag><p>{work.summary.text}</p></div>}
    {!job && <Button onClick={() => void run('DIAGNOSIS')} disabled={busy}>사진·증상 AI 분석 실행 <Icon name="spark"/></Button>}
    {job && <div className="rx-card"><div className="rx-inline"><Tag>{job.type}</Tag><Tag tone={job.status === 'SUCCEEDED' ? 'sage' : 'rose'}>{job.status}</Tag></div>{['QUEUED', 'RUNNING', 'PENDING', 'PROCESSING'].includes(job.status) ? <Spinner text="AI 분석 중이에요. 서버에서 작업 상태를 확인하고 있어요."/> : job.status === 'SUCCEEDED' ? <p>AI 분석이 끝났어요. 내용을 직접 확인하고 수정할 수 있어요.</p> : <><p>{job.error?.message || '분석이 완료되지 않았어요.'}</p><Button kind="secondary" onClick={() => void run(job.type === 'QUESTION' ? 'QUESTION' : 'DIAGNOSIS', true)}>실패 작업 다시 실행</Button></>}</div>}
    {job?.status === 'SUCCEEDED' && job.result?.summary && <div className="rx-card rx-form"><Field label="AI가 정리한 증상 (직접 수정 가능)"><textarea rows={4} value={summary} onChange={e => setSummary(e.target.value)}/></Field><Field label="수리 분야 확인"><select value={field} onChange={e => setField(e.target.value)}>{fieldCodes.map(code => <option key={code} value={code}>{fieldLabel(code)}</option>)}</select></Field><PrivacyNote>AI의 관찰·추정·미확인 사실과 사진 근거는 요약 초안에 유지돼요. 사용자가 최종 확인하기 전에는 확정되지 않아요.</PrivacyNote><Button disabled={busy} onClick={() => void confirm()}>내용 확인 후 해결 방법 보기</Button></div>}
    {questions.length > 0 && <div className="rx-chat-history">{questions.map((q: any) => <div key={q.questionId}><div className="rx-bubble agent"><p>{q.text}</p></div>{(q.answer || q.optionId || q.skipped) && <div className="rx-bubble user"><p>{q.skipped ? '건너뛰었어요' : q.answer || q.options?.find((x: any) => x.optionId === q.optionId)?.label}</p></div>}</div>)}</div>}
    {pending && !request.dialogue?.finished && <div className="rx-card rx-form"><p>추가 질문 · {request.dialogue?.completedRounds || 0}/5</p><strong>{pending.text}</strong>{pending.options?.length ? pending.options.map((o: any) => <button key={o.optionId} className="rx-choice" onClick={() => void dialogue('ANSWER', o.optionId)}>{o.label}</button>) : <Field label="답변"><textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={3}/></Field>}<div className="rx-duo-buttons">{!pending.options?.length && <Button disabled={!answer.trim() || busy} onClick={() => void dialogue('ANSWER')}>답변하기</Button>}<Button kind="outline" onClick={() => void dialogue('SKIP')}>건너뛰기</Button></div></div>}
    {request.dialogue?.finished ? <div className="rx-softline">추가 질문이 종료됐어요.</div> : !pending && request.dialogue?.completedRounds < 5 && <Button kind="outline" onClick={() => void run('QUESTION')} disabled={busy}>AI에게 추가 질문받기</Button>}
    {!request.dialogue?.finished && <button className="rx-link" onClick={() => void dialogue('FINISH')}>질문 없이 여기서 마치기</button>}
    <Button kind="secondary" onClick={() => navigate('solutions', request.requestId)}>셀프 수리·공식 AS·기사 연결 확인 <Icon name="arrow"/></Button><PrivacyNote>안전 위험이 의심되면 AI 분석을 기다리지 말고 필요한 긴급 조치를 먼저 확인하세요.</PrivacyNote></div></>;
}
