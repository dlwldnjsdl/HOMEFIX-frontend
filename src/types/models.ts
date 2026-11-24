export type Role = 'USER' | 'TECHNICIAN';
export type LooseRecord = Record<string, any>;
export interface Session {
    activeRole: Role;
    availableRoles: Role[];
    loginId?: string;
    userId?: string;
    technicianId?: string;
    profile?: {
        displayName?: string;
    };
    displayName?: string;
}
export interface WorkItem {
    workItemId: string;
    requestId?: string;
    revision?: string;
    sourceRevision?: string;
    status: string;
    facts?: {
        part?: string;
        fields?: string[];
        [key: string]: unknown;
    };
    summary?: {
        text: string;
        facts?: LooseRecord[];
        unknowns?: string[];
        riskSignals?: string[];
        limitations?: string[];
    };
    reviewStatus?: string;
    resolutionPath?: string;
    activeReservationId?: string;
    [key: string]: any;
}
export interface Request {
    requestId: string;
    revision?: string;
    sourceRevision?: string;
    symptom: string;
    status: string;
    updatedAt?: string;
    workItems: WorkItem[];
    photos?: {
        confirmedDatePhotos?: Photo[];
        unconfirmedDatePhotos?: Photo[];
        unknownDatePhotos?: Photo[];
    };
    dialogue?: LooseRecord;
    region?: LooseRecord;
    [key: string]: any;
}
export interface Photo {
    photoId: string;
    media: {
        mediaId: string;
        contentType?: string;
    };
    description?: string;
    capturedOn?: string;
    uploadedAt?: string;
    [key: string]: any;
}
export interface Technician {
    technicianId: string;
    displayName: string;
    fields?: string[];
    regions?: Array<{
        district?: string;
        neighborhood?: string;
    }>;
    contacts?: Array<{
        label: string;
        value: string;
    }>;
    directContactAvailable?: boolean;
    [key: string]: any;
}
export interface Quote {
    quoteId: string;
    workItemId: string;
    technicianId: string;
    status: string;
    selectable?: boolean;
    price?: LooseRecord;
    terms?: LooseRecord;
    reasons?: string[];
    revision?: string;
    [key: string]: any;
}
export interface Reservation {
    reservationId: string;
    workItemId: string;
    status: string;
    agreement?: LooseRecord;
    [key: string]: any;
}
export interface Consultation {
    consultationId: string;
    technicianId: string;
    workItemId: string;
    status: string;
    quotes?: Quote[];
    quoteContext?: LooseRecord;
    [key: string]: any;
}
export interface AiJob {
    jobId: string;
    type: string;
    status: string;
    result?: LooseRecord;
    [key: string]: any;
}
export interface PageResult<T> {
    items: T[];
    nextCursor?: string | null;
}
