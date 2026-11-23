import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import { PageHeader, Field, Icon, Button, PrivacyNote } from '../components/UI';
import { assertPhotos, maxPhotoCount, today } from '../lib/format';
import type { Request } from '../types/models';

type RequestExamplePreset = {
    key: 'scenario1' | 'scenario2';
    buttonLabel: string;
    symptom: string;
    part: string;
    capturedOn: string;
    district: string;
    neighborhood: string;
    ai: boolean;
    product: { productType: string; manufacturer: string; modelName: string };
    photos: { asset: string; filename: string; description: string }[];
};

const REQUEST_PRESETS: RequestExamplePreset[] = [
    {
        key: 'scenario1',
        buttonLabel: '시나리오 1 채우기 (미닫이문 · 사진 2장)',
        symptom: '열 때는 괜찮은데, 닫히기 10cm쯤 전부터 바닥을 긁으면서 걸려요.',
        part: '거실 미닫이문 하단 레일',
        capturedOn: '',
        district: '마포구',
        neighborhood: '연남동',
        ai: false,
        product: { productType: '미닫이문', manufacturer: '고쳐야집 모의 도어', modelName: 'SD-100' },
        photos: [
            { asset: 'sample-sliding-door-full.jpg', filename: 'sample-sliding-door-full.jpg', description: '거실 미닫이문 전체 사진' },
            { asset: 'sample-sliding-door-rail.jpg', filename: 'sample-sliding-door-rail.jpg', description: '미닫이문 하단 레일 사진' },
        ],
    },
    {
        key: 'scenario2',
        buttonLabel: '시나리오 2 채우기 (수전 교체 · 사진 1장)',
        symptom: '연남동 싱크대 수전 한 개를 교체하려고 해요. 목요일 오후 중 한 시간 방문 가능합니다.',
        part: '싱크대 수전',
        capturedOn: 'TODAY',
        district: '마포구',
        neighborhood: '연남동',
        ai: false,
        product: { productType: '싱크대 수전', manufacturer: '고쳐야집 모의 수전', modelName: 'FK-200' },
        photos: [
            { asset: 'sample-sink-drain-leak.jpg', filename: 'sample-sink-drain-leak.jpg', description: '싱크대 수전 사진' },
        ],
    },
];

export default function NewRequestPage() {
    const { session, navigate, mutate, busy, notice } = useApp();
    const [step, setStep] = useState(0);
    const [symptom, setSymptom] = useState('');
    const [part, setPart] = useState('');
    const [productType, setProductType] = useState('');
    const [manufacturer, setManufacturer] = useState('');
    const [modelName, setModelName] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [photoDescriptions, setPhotoDescriptions] = useState<string[]>([]);
    const [captured, setCaptured] = useState('');
    const [district, setDistrict] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [ai, setAI] = useState(true);
    const [urgent, setUrgent] = useState(false);
    const [previews, setPreviews] = useState<{ file: File; url: string; description: string }[]>([]);
    const [loadingExample, setLoadingExample] = useState<string | null>(null);
    const photoCacheRef = useRef<Record<string, File>>({});
    const photoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const nextPreviews = files.map((file, i) => ({
            file,
            url: URL.createObjectURL(file),
            description: photoDescriptions[i] || '',
        }));
        setPreviews(nextPreviews);
        return () => nextPreviews.forEach(({ url }) => URL.revokeObjectURL(url));
    }, [files, photoDescriptions]);

    function selectPhotos(event: ChangeEvent<HTMLInputElement>) {
        const input = event.currentTarget;
        const selected = Array.from(input.files ?? []);
        try {
            assertPhotos(selected);
            setFiles(selected);
            setPhotoDescriptions(selected.map(() => ''));
        } catch (error) {
            notice((error as Error).message, 'error');
            input.value = '';
        }
    }

    async function loadAssetFile(asset: string, filename: string): Promise<File> {
        const cached = photoCacheRef.current[asset];
        if (cached)
            return cached;
        const response = await fetch(`/assets/${asset}`);
        if (!response.ok)
            throw new Error(`예시 사진(${asset})을 불러오지 못했어요.`);
        const blob = await response.blob();
        const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
        photoCacheRef.current[asset] = file;
        return file;
    }

    async function fillPreset(preset: RequestExamplePreset) {
        setLoadingExample(preset.key);
        try {
            const loadedFiles = await Promise.all(preset.photos.map(p => loadAssetFile(p.asset, p.filename)));
            assertPhotos(loadedFiles);
            if (photoInputRef.current)
                photoInputRef.current.value = '';
            setFiles(loadedFiles);
            setPhotoDescriptions(preset.photos.map(p => p.description));
            setSymptom(preset.symptom);
            setPart(preset.part);
            setProductType(preset.product.productType);
            setManufacturer(preset.product.manufacturer);
            setModelName(preset.product.modelName);
            setCaptured(preset.capturedOn === 'TODAY' ? today() : preset.capturedOn);
            setDistrict(preset.district);
            setNeighborhood(preset.neighborhood);
            setAI(preset.ai);
            setUrgent(false);
            notice(`${preset.key === 'scenario1' ? '시나리오 1' : '시나리오 2'} 예시 사진과 내용을 채웠어요.`);
        } catch {
            notice('예시를 불러오지 못했어요. 다시 시도해 주세요.', 'error');
        } finally {
            setLoadingExample(null);
        }
    }

    function removePhoto(index: number) {
        setFiles(current => current.filter((_, i) => i !== index));
        setPhotoDescriptions(current => current.filter((_, i) => i !== index));
    }

    function next(event: FormEvent) {
        event.preventDefault();
        if (loadingExample) {
            return;
        }
        if (!symptom.trim()) {
            notice('증상을 입력해 주세요.', 'error');
            return;
        }
        try {
            assertPhotos(files);
        } catch (error) {
            notice((error as Error).message, 'error');
            return;
        }
        setStep(1);
    }
    async function save() {
        if (!session)
            return navigate('login');
        await mutate(async () => {
            const photos = files.map((_, index) => ({
                capturedOn: captured || null,
                dateConfirmed: !!captured,
                description: photoDescriptions[index]?.trim() || null,
                workItemIds: [],
            }));
            const metadata: any = { symptom: symptom.trim(), photos, urgent };
            if (district && neighborhood)
                metadata.region = { city: '서울특별시', district, neighborhood };
            if (part)
                metadata.context = { locationDescription: part };
            if (productType.trim() || manufacturer.trim() || modelName.trim()) {
                metadata.product = {
                    productType: productType.trim() || null,
                    manufacturer: manufacturer.trim() || null,
                    modelName: modelName.trim() || null,
                };
            }
            const record = await api.newRequest(files, metadata) as Request;
            navigate(ai ? 'ai' : 'detail', record.requestId);
        }, '수리 기록을 저장했어요.');
    }
    return <><PageHeader title="AI 사진 진단"/><div className="rx-body"><div className="rx-steps"><span>STEP {step + 1} / 3</span><div><i style={{ width: `${((step + 1) / 3) * 100}%` }}/></div></div><h2 className="rx-page-title">{['집에 어떤 문제가 생겼나요?', '어떤 도움을 받을까요?', '이 내용으로 시작할까요?'][step]}</h2><p className="rx-lead">{['사진과 설명을 올리면 상황을 함께 살펴봐요.', 'AI 이용 여부는 사용자가 직접 선택해요.', '기사 예약 없이도 사진 진단을 받을 수 있어요.'][step]}</p>
    {step === 0 && (
        <form onSubmit={next} className="rx-form" aria-busy={!!loadingExample}>
            <div className="rx-duo-buttons">
                {REQUEST_PRESETS.map(preset => (
                    <Button key={preset.key} kind="outline" disabled={!!loadingExample} onClick={() => void fillPreset(preset)}>
                        <Icon name="edit" size={16}/>
                        {loadingExample === preset.key ? '불러오는 중…' : preset.buttonLabel}
                    </Button>
                ))}
            </div>
            <Field label="증상 설명 *">
                <textarea
                    rows={4}
                    value={symptom}
                    onChange={event => setSymptom(event.target.value)}
                    placeholder="예) 천장에 물자국이 생기고 점점 넓어지는 것 같아요."
                    disabled={!!loadingExample}
                    required
                />
            </Field>
            <Field label="문제 부위 사진 *">
                <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    multiple
                    disabled={!!loadingExample}
                    onChange={selectPhotos}
                />
                <small>{files.length}/{maxPhotoCount} · JPG/PNG · 파일당 10MB 이하</small>
            </Field>
            <div className="rx-preview-row">
                {previews.map(({ url, description }, index) => {
                    const label = description || `선택 사진 ${index + 1}`;
                    return (
                        <div key={url}>
                            <img src={url} alt={label} title={label}/>
                            <button
                                type="button"
                                aria-label={`${label} 삭제`}
                                disabled={!!loadingExample}
                                onClick={() => removePhoto(index)}
                            >
                                <Icon name="close" size={13}/>
                            </button>
                        </div>
                    );
                })}
            </div>
            {photoDescriptions.some(Boolean) && (
                <p className="rx-muted">첨부 사진 설명: {photoDescriptions.filter(Boolean).join(' · ')}</p>
            )}
            <Field label="고장 위치 (선택)">
                <input
                    value={part}
                    onChange={event => setPart(event.target.value)}
                    placeholder="예) 거실 창가"
                    disabled={!!loadingExample}
                />
            </Field>
            <Field label="사진 촬영일 (확인한 경우만)">
                <input
                    type="date"
                    max={today()}
                    value={captured}
                    onChange={event => setCaptured(event.target.value)}
                    disabled={!!loadingExample}
                />
            </Field>
            <Button type="submit" disabled={!!loadingExample}>계속하기 <Icon name="arrow"/></Button>
        </form>
    )}
    {step === 1 && <div className="rx-form"><div className="rx-choice-row"><button className={`rx-choice ${ai ? 'chosen' : ''}`} onClick={() => setAI(true)}><Icon name="spark"/> AI 상담으로 시작하기</button><button className={`rx-choice ${!ai ? 'chosen' : ''}`} onClick={() => setAI(false)}><Icon name="edit"/> 직접 해결 경로 선택</button></div><Field label="서울 구 (선택, 기사 연결 전 확인)"><input value={district} onChange={e => setDistrict(e.target.value)} placeholder="예) 마포구"/></Field><Field label="동 (선택)"><input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="예) 연남동"/></Field><label className="rx-check"><input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)}/> 긴급한 상황이에요</label><PrivacyNote>사진 진단에 상세 주소·연락처는 필요하지 않아요. 위험 상황은 검증된 긴급 안내가 우선이에요.</PrivacyNote><Button onClick={() => setStep(2)}>내용 확인하기 <Icon name="arrow"/></Button></div>}
    {step === 2 && <div className="rx-form"><div className="rx-card"><span className="rx-overline">증상</span><h3>{symptom}</h3><p>사진 {files.length}장 · {part || '부위 미입력'}</p><p>AI 상담: {ai ? '이용' : '이용하지 않음'}</p><p>지역: {district && neighborhood ? `${district} ${neighborhood}` : '기사 추천 전에 입력 예정'}</p></div><PrivacyNote>수리 요청 기록을 서버에 생성하지만, 기사에게 자동으로 상담·예약되지 않아요.</PrivacyNote><Button disabled={busy} onClick={() => void save()}>{ai ? '기록 저장 후 AI 상담' : '기록 저장하고 계속하기'} <Icon name="arrow"/></Button></div>}
    </div></>;
}
