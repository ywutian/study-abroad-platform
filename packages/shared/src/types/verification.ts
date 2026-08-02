export const VERIFICATION_PROOF_TYPE = {
  OFFER_LETTER: 'offer_letter',
  ENROLLMENT_PROOF: 'enrollment_proof',
  STUDENT_ID: 'student_id',
} as const;

export type VerificationProofType =
  (typeof VERIFICATION_PROOF_TYPE)[keyof typeof VERIFICATION_PROOF_TYPE];

export type VerificationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface VerificationSubmission {
  caseId: string;
  proofType: VerificationProofType;
  proofData?: string;
  proofUrl?: string;
}

export interface VerificationRequest {
  id: string;
  status: VerificationRequestStatus;
  proofType: VerificationProofType;
  createdAt: string;
  reviewNote?: string | null;
  case: {
    id: string;
    year?: number;
    round?: string;
    school?: { id: string; name: string; nameZh?: string | null };
  };
}

export interface VerificationAccountStatus {
  emailVerified?: boolean;
  identityVerified?: boolean;
  status?: VerificationRequestStatus | 'NONE';
}
