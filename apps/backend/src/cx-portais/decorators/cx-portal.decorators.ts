import { SetMetadata } from '@nestjs/common';

export const CX_PORTAL_SEGMENT = 'cx_portal_segment';
export type CxPortalSegmentValue = 'cliente' | 'fornecedor';

export const CxPortalSegment = (s: CxPortalSegmentValue) => SetMetadata(CX_PORTAL_SEGMENT, s);

export const CX_PORTAL_STAFF_ONLY = 'cx_portal_staff_only';
export const CxPortalStaffOnly = () => SetMetadata(CX_PORTAL_STAFF_ONLY, true);
