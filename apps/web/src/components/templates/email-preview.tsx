import DOMPurify from "dompurify";

interface EmailPreviewProps {
  senderName: string;
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
  signatureHtml: string | null;
  hasPaymentLink: boolean;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const SANITIZE_OPTS = {
  FORBID_TAGS: ["script", "style", "iframe"],
  FORBID_ATTR: ["onerror", "onload", "onclick"],
};

function clean(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_OPTS);
}

export function EmailPreview({
  senderName,
  recipientEmail,
  subject,
  bodyHtml,
  signatureHtml,
  hasPaymentLink,
}: EmailPreviewProps) {
  return (
    // Always-light card: real inboxes render light regardless of app theme.
    <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-[0_12px_36px_-12px_rgba(15,23,42,0.35)]">
      <div className="border-b border-slate-100 px-[18px] py-[15px]">
        <div className="mb-[9px] text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
          {subject || "No subject"}
        </div>
        <div className="flex items-center gap-[10px]">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-[13px] font-semibold text-white">
            {initials(senderName)}
          </span>
          <div>
            <div className="text-[12.5px] font-semibold text-slate-900">{senderName}</div>
            <div className="text-[11px] text-slate-500">to {recipientEmail}</div>
          </div>
        </div>
      </div>
      <div className="px-[18px] py-[18px] text-[13px] leading-[1.6] text-slate-800">
        <div
          className="whitespace-pre-wrap [&_a]:text-indigo-600 [&_a]:underline [&_b]:text-slate-900 [&_strong]:text-slate-900"
          dangerouslySetInnerHTML={{ __html: clean(bodyHtml) }}
        />
        {hasPaymentLink && (
          <a
            href={SAMPLE_DATA_PAYMENT_LINK}
            className="my-[14px] inline-block rounded-[8px] bg-indigo-600 px-5 py-[11px] text-[13px] font-semibold text-white no-underline"
          >
            Pay invoice →
          </a>
        )}
        {signatureHtml && (
          <div
            className="mt-3 whitespace-pre-wrap border-t border-slate-100 pt-3 text-[12px] leading-[1.5] text-slate-500 [&_strong]:text-slate-900"
            dangerouslySetInnerHTML={{ __html: clean(signatureHtml) }}
          />
        )}
      </div>
    </div>
  );
}

const SAMPLE_DATA_PAYMENT_LINK = "https://pay.nudge.app/inv-1042";
