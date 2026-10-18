"use client";

import { useId, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  applyPostOffices,
  emptyShippingAddress,
  formatShippingAddress,
  shippingAddressProblem,
  type ShippingAddress,
} from "@/lib/address";
import { formatIndianMobile, indianMobile } from "@/lib/phone";
import { usePincodeLookup } from "@/lib/use-pincode-lookup";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

/** What the checkout sends with the order once the address is complete. */
export type ShippingDetails = {
  /** The whole address as lines, which is how the order stores it. */
  shippingAddress: string;
  /** "+91 98765 43210". */
  phoneNumber: string;
  /** "+919876543210", for prefilling the payment window. */
  contact: string;
};

/**
 * The checkout's delivery address. Typing a PIN code looks it up with India
 * Post and fills in the locality, city and state; the state is then fixed by
 * the PIN code, while the city stays editable.
 *
 * The submit button lives in the order summary, outside this form, and joins
 * it through its `form` attribute, so `id` is required.
 *
 * Problems are reported on submit, under the field concerned, which also takes
 * focus. From then on they're re-checked as the customer types, so a fixed
 * field clears at once.
 */
export function ShippingAddressForm({
  id,
  defaultName,
  onSubmit,
  onInvalid,
  onEdit,
  className,
}: {
  id: string;
  /** Prefills the recipient; the signed-in account's name. */
  defaultName?: string;
  onSubmit: (details: ShippingDetails) => void;
  /** Called when a submit was refused because something is missing. */
  onInvalid: () => void;
  /** Called whenever the customer changes a field, e.g. to retire a message about the address. */
  onEdit?: () => void;
  className?: string;
}) {
  const [address, setAddress] = useState(() => emptyShippingAddress(defaultName));
  const [attempted, setAttempted] = useState(false);
  const fieldPrefix = useId();
  const fieldId = (field: keyof ShippingAddress) => `${fieldPrefix}${field}`;

  const pincode = usePincodeLookup(address.pincode, (offices) =>
    setAddress((current) => applyPostOffices(current, offices))
  );
  const problem = attempted ? shippingAddressProblem(address, pincode) : null;

  const update = (patch: Partial<ShippingAddress>) => {
    setAddress((current) => ({ ...current, ...patch }));
    onEdit?.();
  };

  /** The props every field shares: id, value, and its error wiring. */
  const control = (field: keyof ShippingAddress) => {
    const invalid = problem?.field === field;
    return {
      id: fieldId(field),
      value: address[field],
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? `${fieldId(field)}-error` : undefined,
    };
  };
  const errorFor = (field: keyof ShippingAddress) =>
    problem?.field === field ? (
      <p id={`${fieldId(field)}-error`} className="text-small text-danger">
        {problem.message}
      </p>
    ) : null;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = shippingAddressProblem(address, pincode);
    if (found) {
      setAttempted(true);
      document.getElementById(fieldId(found.field))?.focus();
      onInvalid();
      return;
    }
    const mobile = indianMobile(address.phone)!;
    onSubmit({
      shippingAddress: formatShippingAddress(address),
      phoneNumber: formatIndianMobile(mobile),
      contact: `+91${mobile}`,
    });
  };

  const office = pincode.postOffices.find((o) => o.name === address.locality) ?? pincode.postOffices[0];
  const pincodeStatus =
    pincode.status === "loading" ? (
      <>
        <Loader2 aria-hidden className="size-3.5 animate-spin" /> Looking up PIN code…
      </>
    ) : pincode.status === "found" && office ? (
      <>
        <CheckCircle2 aria-hidden className="size-3.5 text-success" /> {office.district}, {office.state}
      </>
    ) : pincode.status === "not-found" ? (
      "We couldn't find this PIN code. Please check it."
    ) : pincode.status === "unavailable" ? (
      "We couldn't check this PIN code right now. Please enter your city and state below."
    ) : (
      "Your locality, city and state fill in from the PIN code."
    );
  const pincodeInvalid = problem?.field === "pincode";

  return (
    <form id={id} noValidate onSubmit={submit} className={cn("space-y-5", className)}>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id={fieldId("fullName")} label="Full name" error={errorFor("fullName")}>
          <Input
            {...control("fullName")}
            name="name"
            autoComplete="shipping name"
            required
            maxLength={120}
            onChange={(e) => update({ fullName: e.target.value })}
          />
        </Field>
        <Field id={fieldId("phone")} label="Mobile number" error={errorFor("phone")}>
          <Input
            {...control("phone")}
            name="tel"
            type="tel"
            inputMode="tel"
            autoComplete="shipping tel"
            required
            maxLength={20}
            placeholder="10-digit mobile number"
            onChange={(e) => update({ phone: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={fieldId("pincode")}>PIN code</Label>
          <Input
            {...control("pincode")}
            aria-describedby={`${fieldId("pincode")}-status`}
            name="postal-code"
            inputMode="numeric"
            autoComplete="shipping postal-code"
            required
            maxLength={6}
            placeholder="6-digit PIN code"
            className="tabular-nums"
            onChange={(e) => {
              // Browsers autofill "110 001" or "110001.", and a paste can carry anything.
              const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
              // A different PIN code is a different place: what the old one
              // filled in no longer applies, and the lookup refills it.
              if (digits !== address.pincode) update({ pincode: digits, locality: "", city: "", state: "" });
            }}
          />
          <p
            id={`${fieldId("pincode")}-status`}
            aria-live="polite"
            className={cn(
              "flex min-h-5 items-center gap-1.5 text-small",
              pincodeInvalid || pincode.status === "not-found" ? "text-danger" : "text-muted-foreground"
            )}
          >
            {pincodeInvalid ? problem.message : pincodeStatus}
          </p>
        </div>

        {pincode.status === "unavailable" ? (
          // Without the lookup there's no list to choose from, so it's typed.
          <Field id={fieldId("locality")} label="Locality" optional>
            <Input
              {...control("locality")}
              name="locality"
              maxLength={120}
              onChange={(e) => update({ locality: e.target.value })}
            />
          </Field>
        ) : (
          <Field id={fieldId("locality")} label="Locality" error={errorFor("locality")}>
            <NativeSelect
              {...control("locality")}
              name="locality"
              required
              disabled={pincode.status !== "found"}
              onChange={(e) => {
                const chosen = pincode.postOffices.find((o) => o.name === e.target.value);
                update({ locality: e.target.value, ...(chosen?.district && { city: chosen.district }) });
              }}
            >
              <option value="" disabled>
                {pincode.status === "found" ? "Select your locality" : "Enter your PIN code first"}
              </option>
              {pincode.postOffices.map((o) => (
                <option key={o.name} value={o.name}>
                  {o.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>

      <Field id={fieldId("line1")} label="Flat, house no., building, company" error={errorFor("line1")}>
        <Input
          {...control("line1")}
          name="address-line1"
          autoComplete="shipping address-line1"
          required
          maxLength={160}
          onChange={(e) => update({ line1: e.target.value })}
        />
      </Field>
      <Field id={fieldId("line2")} label="Area, street, sector, village" error={errorFor("line2")}>
        <Input
          {...control("line2")}
          name="address-line2"
          autoComplete="shipping address-line2"
          required
          maxLength={160}
          onChange={(e) => update({ line2: e.target.value })}
        />
      </Field>
      <Field id={fieldId("landmark")} label="Landmark" optional>
        <Input
          {...control("landmark")}
          name="landmark"
          maxLength={120}
          placeholder="E.g. near Apollo Hospital"
          onChange={(e) => update({ landmark: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id={fieldId("city")} label="City / District" error={errorFor("city")}>
          <Input
            {...control("city")}
            name="city"
            autoComplete="shipping address-level2"
            required
            maxLength={80}
            onChange={(e) => update({ city: e.target.value })}
          />
        </Field>
        <Field id={fieldId("state")} label="State" error={errorFor("state")}>
          <Input
            {...control("state")}
            name="state"
            autoComplete="shipping address-level1"
            required
            maxLength={80}
            // The PIN code settles the state; typed only when it couldn't be checked.
            readOnly={pincode.status === "found"}
            className="read-only:bg-muted"
            onChange={(e) => update({ state: e.target.value })}
          />
        </Field>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  optional = false,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {error}
    </div>
  );
}
