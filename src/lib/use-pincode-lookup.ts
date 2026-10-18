"use client";

import { useEffect, useEffectEvent, useState } from "react";
import type { PincodeStatus } from "./address";
import { isPincode, lookupPincode, type PincodeLookup, type PostOffice } from "./pincode";

/**
 * Looks `pincode` up as soon as it has all six digits, and calls `onFound`
 * with its post offices so the form can fill itself in.
 *
 * Changing the PIN code again abandons the lookup in flight, so a slow answer
 * for an old code never overwrites the new one.
 */
export function usePincodeLookup(
  pincode: string,
  onFound: (postOffices: PostOffice[]) => void
): { status: PincodeStatus; postOffices: PostOffice[] } {
  const [result, setResult] = useState<{ pincode: string; lookup: PincodeLookup } | null>(null);
  const found = useEffectEvent(onFound);

  useEffect(() => {
    if (!isPincode(pincode)) return;
    const controller = new AbortController();
    lookupPincode(pincode, controller.signal)
      .then((lookup) => {
        setResult({ pincode, lookup });
        if (lookup.status === "found") found(lookup.postOffices);
      })
      .catch(() => {
        // Aborted: a newer PIN code has taken over.
      });
    return () => controller.abort();
  }, [pincode]);

  if (!isPincode(pincode)) return { status: "idle", postOffices: [] };
  if (result?.pincode !== pincode) return { status: "loading", postOffices: [] };
  const { lookup } = result;
  return { status: lookup.status, postOffices: lookup.status === "found" ? lookup.postOffices : [] };
}
