"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { Crisp } from "crisp-sdk-web";

const CRISP_WEBSITE_ID = String(
  process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID || "",
).trim();

let isCrispConfigured = false;
let warnedMissingWebsiteId = false;

function getDisplayName(user) {
  const firstName = String(user?.firstName || "").trim();
  const lastName = String(user?.lastName || "").trim();
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (combined) {
    return combined;
  }

  const username = String(user?.username || "").trim();
  if (username) {
    return username;
  }

  return "User";
}

function getPrimaryEmail(user) {
  const primary = String(user?.primaryEmailAddress?.emailAddress || "").trim();
  if (primary) {
    return primary;
  }

  return String(user?.emailAddresses?.[0]?.emailAddress || "").trim();
}

export default function CrispChat() {
  const { isSignedIn, user } = useUser();
  const previousSignedInRef = useRef(null);

  useEffect(() => {
    if (!CRISP_WEBSITE_ID) {
      if (!warnedMissingWebsiteId) {
        console.warn(
          "Crisp disabled: NEXT_PUBLIC_CRISP_WEBSITE_ID is not set.",
        );
        warnedMissingWebsiteId = true;
      }
      return;
    }

    if (!isCrispConfigured) {
      Crisp.configure(CRISP_WEBSITE_ID);
      isCrispConfigured = true;
    }

    if (isSignedIn && user) {
      const email = getPrimaryEmail(user);
      const nickname = getDisplayName(user);

      if (email) {
        Crisp.user.setEmail(email);
      }

      if (nickname) {
        Crisp.user.setNickname(nickname);
      }
    } else if (previousSignedInRef.current === true) {
      Crisp.session.reset();
    }

    previousSignedInRef.current = Boolean(isSignedIn);
  }, [isSignedIn, user]);

  return null;
}
