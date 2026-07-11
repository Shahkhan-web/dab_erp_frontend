import {
    INVOICE_ATTACHMENT_MAX_BYTES,
} from '../services/invoices.service';

export function defaultAttachmentDisplayName(file: File): string {
    return file.name.replace(/\.[^/.]+$/, '') || file.name;
}

export function validateInvoiceAttachmentFile(file: File): string | null {
    if (file.size > INVOICE_ATTACHMENT_MAX_BYTES) {
        return `File must be at most ${Math.round(INVOICE_ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB.`;
    }
    const okMime =
        !file.type ||
        ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type);
    const okExt = /\.(pdf|jpe?g|png|webp|gif)$/i.test(file.name.toLowerCase());
    if (!okMime && !okExt) return 'Allowed types: PDF, JPEG, PNG, WebP, GIF.';
    return null;
}
