"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { SITE_CONFIG } from "@/lib/constants";
import { ApiError, submitEnquiry } from "@/lib/api";
import { ENQUIRY_SUBJECTS, enquirySubjectLabel, isEnquirySubject } from "@/lib/enquiries";
import { isPhoneNumber } from "@/lib/phone";
import { warmBackend } from "@/lib/warm-backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type Status =
  | { state: "idle" | "sending" }
  | { state: "sent"; email: string }
  | { state: "error"; message: string; mailto: string };

/**
 * Contact form. A submission is saved by the backend and shows up in the admin
 * panel under Enquiries.
 *
 * If saving fails (the backend is down, or cold-starting past the request's
 * patience) the visitor is shown the reason together with a mailto link that
 * carries everything they typed, so the message isn't lost.
 *
 * A product page's "Request a quote" arrives here as
 * ?topic=quote&product=…&qty=…, which pre-fills the subject and message.
 */
export function ContactForm({ topic, product, quantity }: { topic?: string; product?: string; quantity?: string }) {
  const ids = { name: useId(), email: useId(), phone: useId(), company: useId(), subject: useId(), message: useId() };
  const [phoneInvalid, setPhoneInvalid] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState<string>(isEnquirySubject(topic) ? topic : "");
  const [message, setMessage] = useState(
    product ? `I'd like a quote for ${quantity ? `${quantity} × ` : ""}${product}.\n\n` : ""
  );
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const thanksRef = useRef<HTMLHeadingElement>(null);

  // The backend sleeps when idle and takes up to ~90s to wake. Poking it as the
  // form appears lets it start up while the visitor is typing.
  useEffect(warmBackend, []);

  // The thank-you replaces the taller form, possibly above the viewport.
  // Focusing it scrolls it into view and has screen readers announce it.
  useEffect(() => {
    if (status.state === "sent") thanksRef.current?.focus();
  }, [status.state]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const field = (name: string) => String(data.get(name) ?? "").trim();

    const input = {
      name: field("name"),
      email: field("email"),
      phone: field("phone"),
      company: field("company"),
      subject,
      message: message.trim(),
      product: product?.trim(),
      quantity: quantity?.trim(),
      website: field("website"),
    };

    // The browser has already insisted on something being there; this checks
    // it's a number we can call back.
    if (!isPhoneNumber(input.phone)) {
      setPhoneInvalid(true);
      phoneRef.current?.focus();
      return;
    }

    setStatus({ state: "sending" });
    try {
      await submitEnquiry(input);
      setStatus({ state: "sent", email: input.email });
      setSubject("");
      setMessage("");
    } catch (error) {
      setStatus({
        state: "error",
        message:
          error instanceof ApiError && error.status && error.status < 500
            ? error.message
            : "We couldn't send your message just now.",
        mailto: mailtoFallback(input),
      });
    }
  };

  if (status.state === "sent") {
    return (
      <div className="rounded-card border border-border bg-surface p-8">
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <h2 ref={thanksRef} tabIndex={-1} className="mt-4 scroll-mt-28 text-h3 outline-none">
          Thank you for contacting us!
        </h2>
        <p className="mt-2 text-body text-muted-foreground">
          We&apos;ve received your message and will get back to you soon. Our reply will go to{" "}
          <span className="font-medium break-all text-foreground">{status.email}</span>.
        </p>
        <Button className="mt-6" variant="outline" onClick={() => setStatus({ state: "idle" })}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field id={ids.name} label="Full name">
          <Input id={ids.name} name="name" autoComplete="name" required maxLength={120} />
        </Field>
        <Field id={ids.email} label="Email address">
          <Input id={ids.email} name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@company.com" />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field id={ids.phone} label="Phone number">
          <Input
            ref={phoneRef}
            id={ids.phone}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            maxLength={20}
            placeholder="+91 98765 43210"
            aria-invalid={phoneInvalid || undefined}
            aria-describedby={phoneInvalid ? `${ids.phone}-error` : undefined}
            onChange={() => setPhoneInvalid(false)}
          />
          {phoneInvalid && (
            <p id={`${ids.phone}-error`} className="text-small text-danger">
              Please enter a valid phone number. Outside India, include your country code.
            </p>
          )}
        </Field>
        <Field id={ids.company} label="Company" optional>
          <Input id={ids.company} name="company" autoComplete="organization" maxLength={160} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field id={ids.subject} label="Subject">
          <NativeSelect id={ids.subject} name="subject" required value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="" disabled>
              Select a subject
            </option>
            {ENQUIRY_SUBJECTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field id={ids.message} label="Message">
        <Textarea
          id={ids.message}
          name="message"
          rows={6}
          required
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us about your project — quantities, read range, environment, timelines."
        />
      </Field>

      {/* Honeypot: invisible and unreachable for people, tempting for bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" startIcon={<Send />} loading={status.state === "sending"} loadingText="Sending…">
          Send message
        </Button>
        <p aria-live="polite" className="text-small text-muted-foreground">
          {status.state === "sending" && "Sending — this can take a moment if our server is waking up."}
        </p>
      </div>

      {status.state === "error" && (
        <p role="alert" className="text-small text-danger">
          {status.message} Please try again, or{" "}
          <a href={status.mailto} className="font-medium underline underline-offset-4">
            email it to {SITE_CONFIG.email}
          </a>{" "}
          instead.
        </p>
      )}
    </form>
  );
}

/** A mailto link carrying the whole message, for when the backend can't take it. */
function mailtoFallback(input: {
  name: string;
  email: string;
  phone: string;
  company: string;
  subject: string;
  message: string;
  product?: string;
}) {
  const label = input.subject ? enquirySubjectLabel(input.subject) : "Website enquiry";
  const body = [
    input.message,
    "",
    "—",
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone}`,
    ...(input.company ? [`Company: ${input.company}`] : []),
  ].join("\n");
  const title = input.product ? `${label}: ${input.product}` : label;
  return `mailto:${SITE_CONFIG.email}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function Field({
  id,
  label,
  optional = false,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
    </div>
  );
}
