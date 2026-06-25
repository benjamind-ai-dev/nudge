import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmailPreview } from "./email-preview";

describe("EmailPreview", () => {
  it("renders the resolved subject and body", () => {
    render(
      <EmailPreview
        senderName="Sarah Chen"
        recipientEmail="jordan@brightmail.co"
        subject="Overdue: invoice #INV-1042"
        bodyHtml="<p>Invoice <b>#INV-1042</b> is overdue.</p>"
        signatureHtml="<strong>Sarah</strong>"
        hasPaymentLink
      />,
    );
    expect(screen.getByText("Overdue: invoice #INV-1042")).toBeInTheDocument();
    expect(screen.getByText(/is overdue/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pay invoice/i })).toBeInTheDocument();
  });

  it("strips script tags from body HTML", () => {
    render(
      <EmailPreview
        senderName="S"
        recipientEmail="x@y.co"
        subject="s"
        bodyHtml={'<p>ok</p><script>window.__pwned = true;</script>'}
        signatureHtml={null}
        hasPaymentLink={false}
      />,
    );
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText("ok")).toBeInTheDocument();
  });
});
