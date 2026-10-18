"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronRight, Mail, MessageSquare, Package, Phone, Trash2 } from "lucide-react";
import { deleteEnquiry, fetchEnquiries, updateEnquiryStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import { enquirySubjectLabel } from "@/lib/enquiries";
import { ENQUIRY_STATUSES, ENQUIRY_STATUS_META, enquiryStatusMeta } from "@/lib/status";
import { badgeVariants } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Enquiry } from "@/types";

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function AdminEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Enquiry | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setEnquiries(await fetchEnquiries());
      } catch (error) {
        console.error("Failed to load enquiries", error);
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const e of enquiries) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    return byStatus;
  }, [enquiries]);

  const visible = filter === "all" ? enquiries : enquiries.filter((e) => e.status === filter);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateEnquiryStatus(id, status);
      setEnquiries((prev) => prev.map((e) => (e._id === id ? { ...e, status } : e)));
      setSelected((prev) => (prev && prev._id === id ? { ...prev, status } : prev));
    } catch (error) {
      console.error("Failed to update enquiry status", error);
      alert("Failed to update status");
    }
  };

  const handleDelete = async (enquiry: Enquiry) => {
    if (!confirm(`Delete the enquiry from ${enquiry.name}? This can't be undone.`)) return;
    try {
      await deleteEnquiry(enquiry._id);
      setEnquiries((prev) => prev.filter((e) => e._id !== enquiry._id));
      setSelected(null);
    } catch (error) {
      console.error("Failed to delete enquiry", error);
      alert("Failed to delete enquiry");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Enquiries</h1>
        <p className="text-sm text-zinc-500">Messages sent through the contact form and &ldquo;Request a quote&rdquo; links.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {[{ value: "all", label: "All", count: enquiries.length }, ...ENQUIRY_STATUSES.map((s) => ({
          value: s,
          label: ENQUIRY_STATUS_META[s].label,
          count: counts[s] ?? 0,
        }))].map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={filter === tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === tab.value
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            )}
          >
            {tab.label} <span className="tabular-nums opacity-70">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-medium">From</th>
                <th className="px-6 py-4 font-medium">Subject</th>
                <th className="px-6 py-4 font-medium">Message</th>
                <th className="px-6 py-4 font-medium">Received</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    <MessageSquare className="mx-auto mb-2 h-8 w-8 text-zinc-400" />
                    {loadFailed
                      ? "Couldn't load enquiries. Refresh to try again."
                      : enquiries.length === 0
                        ? "No enquiries yet"
                        : "No enquiries with this status"}
                  </td>
                </tr>
              ) : (
                visible.map((enquiry) => (
                  <tr key={enquiry._id} className="group transition-colors hover:bg-zinc-50">
                    <td className="px-6 py-4">
                      <div className={cn("text-zinc-900", enquiry.status === "New" ? "font-semibold" : "font-medium")}>
                        {enquiry.name}
                      </div>
                      <div className="text-xs text-zinc-500">{enquiry.email}</div>
                      {enquiry.phone && <div className="text-xs tabular-nums text-zinc-500">{enquiry.phone}</div>}
                      {enquiry.company && <div className="text-xs text-zinc-500">{enquiry.company}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-zinc-900">{enquirySubjectLabel(enquiry.subject)}</div>
                      {enquiry.product && (
                        <div className="max-w-[220px] truncate text-xs text-zinc-500" title={enquiry.product}>
                          {enquiry.quantity ? `${enquiry.quantity} × ` : ""}
                          {enquiry.product}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="line-clamp-2 max-w-[320px]" title={enquiry.message}>
                        {enquiry.message}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">{dateTime(enquiry.createdAt)}</td>
                    <td className="px-6 py-4">
                      <StatusSelect enquiry={enquiry} onChange={handleStatusChange} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(enquiry)}
                        className="flex w-full items-center justify-end gap-1 font-medium text-blue-600 hover:text-blue-800"
                      >
                        View <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Enquiry from {selected?.name}</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="mt-4 space-y-6">
              <div className="grid grid-cols-1 gap-6 rounded-lg border border-zinc-100 bg-zinc-50 p-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Contact</h4>
                  <div className="text-sm font-medium text-zinc-900">{selected.name}</div>
                  <a
                    href={`mailto:${selected.email}`}
                    className="flex items-center gap-1.5 break-all text-sm text-blue-600 hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {selected.email}
                  </a>
                  {selected.phone && (
                    <a
                      href={`tel:${selected.phone.replace(/[^\d+]/g, "")}`}
                      className="flex items-center gap-1.5 text-sm tabular-nums text-blue-600 hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" /> {selected.phone}
                    </a>
                  )}
                  {selected.company && (
                    <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                      <Building2 className="h-3.5 w-3.5 shrink-0" /> {selected.company}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Enquiry</h4>
                  <div className="text-sm font-medium text-zinc-900">{enquirySubjectLabel(selected.subject)}</div>
                  {selected.product && (
                    <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                      <Package className="h-3.5 w-3.5 shrink-0" />
                      {selected.quantity ? `${selected.quantity} × ` : ""}
                      {selected.product}
                    </div>
                  )}
                  <div className="text-sm text-zinc-500">Received {dateTime(selected.createdAt)}</div>
                </div>
              </div>

              <div>
                <h4 className="mb-2 border-b border-zinc-200 pb-2 text-sm font-semibold text-zinc-900">Message</h4>
                <p className="whitespace-pre-wrap break-words text-sm text-zinc-700">{selected.message}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4">
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  Status
                  <StatusSelect enquiry={selected} onChange={handleStatusChange} />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(selected)}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                  <a
                    href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${enquirySubjectLabel(selected.subject)}`)}`}
                    className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
                  >
                    <Mail className="h-4 w-4" /> Reply by email
                  </a>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusSelect({ enquiry, onChange }: { enquiry: Enquiry; onChange: (id: string, status: string) => void }) {
  return (
    <select
      value={enquiry.status}
      onChange={(e) => onChange(enquiry._id, e.target.value)}
      aria-label={`Status of enquiry from ${enquiry.name}`}
      className={cn(badgeVariants({ tone: enquiryStatusMeta(enquiry.status).tone, size: "md" }), "cursor-pointer")}
    >
      {ENQUIRY_STATUSES.map((status) => (
        <option key={status} value={status}>
          {ENQUIRY_STATUS_META[status].label}
        </option>
      ))}
    </select>
  );
}
