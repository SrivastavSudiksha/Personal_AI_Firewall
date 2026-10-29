"""India-specific deterministic PII recognizers – hardened against common loopholes."""

from __future__ import annotations
import re
from dataclasses import dataclass
from typing import Callable, List, Optional, Tuple


@dataclass
class Match:
    entity_type: str
    value: str
    start: int
    end: int
    confidence: float = 0.9


def luhn_check(number: str) -> bool:
    digits = [int(d) for d in re.sub(r"\D", "", number)]
    if len(digits) < 13 or len(digits) > 19:
        return False
    checksum = 0
    parity = len(digits) % 2
    for i, d in enumerate(digits):
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def verhoeff_check(number: str) -> bool:
    d = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
        [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
        [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
        [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
        [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
        [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
        [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
        [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
        [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    ]
    p = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
        [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
        [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
        [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
        [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
        [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
        [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
    ]
    c = 0
    for i, ch in enumerate(reversed(number)):
        if not ch.isdigit():
            return False
        c = d[c][p[i % 8][int(ch)]]
    return c == 0


# Context keywords that boost ACCOUNT_NO / BALANCE confidence
ACCOUNT_CONTEXT = re.compile(
    r"(?i)(account|a/?c|acct|acc\.?\s*no|account\s*number|bank\s*account|"
    r"savings|current\s*account|iban|beneficiary)"
)
BALANCE_CONTEXT = re.compile(
    r"(?i)(balance|bal\.?|amount|rs\.?|inr|₹|rupees?|credited|debited|available)"
)
AADHAAR_CONTEXT = re.compile(r"(?i)(aadhaar|aadhar|uidai|uid)")


def deterministic_scan(text: str) -> List[Match]:
    matches: List[Match] = []
    occupied: List[Tuple[int, int]] = []

    def overlaps(s: int, e: int) -> bool:
        for a, b in occupied:
            if not (e <= a or s >= b):
                return True
        return False

    def add(etype: str, value: str, start: int, end: int, conf: float):
        if overlaps(start, end):
            return
        matches.append(Match(etype, value, start, end, conf))
        occupied.append((start, end))

    # ---- 1. PAN (very specific) ----
    for m in re.finditer(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b", text):
        add("PAN", m.group(1), m.start(), m.end(), 0.98)

    # ---- 2. IFSC ----
    for m in re.finditer(r"\b([A-Z]{4}0[A-Z0-9]{6})\b", text):
        add("IFSC", m.group(1), m.start(), m.end(), 0.95)

    # ---- 3. Credit / Debit cards (Luhn) ----
    for m in re.finditer(r"\b((?:\d{4}[\s\-]?){3}\d{4})\b", text):
        raw = m.group(1)
        if luhn_check(raw):
            add("CREDIT_CARD", raw, m.start(), m.end(), 0.96)

    # ---- 4. Indian mobile (before Aadhaar to claim 10/12-digit phones) (handles spaces, +91, 0-prefix) ----
    # Prefer this over ACCOUNT_NO for 10-digit numbers starting 6-9
    phone_pat = re.compile(
        r"(?<!\d)(?:\+?91[\s\-]?)?[0]?([6-9](?:[\s\-]?\d){9})(?!\d)"
    )
    for m in phone_pat.finditer(text):
        digits = re.sub(r"\D", "", m.group(0))
        # normalize to last 10 digits if country code present
        if len(digits) > 10:
            digits = digits[-10:]
        if len(digits) == 10 and digits[0] in "6789":
            add("PHONE_IN", m.group(0).strip(), m.start(), m.end(), 0.92)

    # ---- 5. Aadhaar (12 digits) – format first, Verhoeff boosts confidence ----
    for m in re.finditer(r"\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4})\b", text):
        raw = m.group(1)
        digits = re.sub(r"[\s\-]", "", raw)
        if len(digits) != 12:
            continue
        # Skip if this looks like +91XXXXXXXXXX phone (12 digits starting 91 + [6-9])
        if digits.startswith("91") and digits[2] in "6789":
            continue
        # Tight local window (±18 chars) for context to avoid distant keyword bleed
        window = text[max(0, m.start() - 18): m.end() + 8]
        has_acct = bool(ACCOUNT_CONTEXT.search(window))
        has_aad = bool(AADHAAR_CONTEXT.search(window))
        if has_acct and not has_aad:
            continue  # leave for ACCOUNT_NO stage
        if verhoeff_check(digits):
            conf = 0.97
        elif has_aad:
            conf = 0.88
        else:
            conf = 0.52  # weak – only kept if min_confidence allows
        if conf >= 0.52:
            add("AADHAAR", raw, m.start(), m.end(), conf)

    # ---- 6. Email (before UPI) ----
    for m in re.finditer(
        r"\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b", text
    ):
        add("EMAIL", m.group(1), m.start(), m.end(), 0.95)

    # ---- 7. UPI (no TLD in handle part) ----
    for m in re.finditer(r"\b([a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32})\b", text):
        handle, domain = m.group(1).split("@", 1)
        if "." in domain:  # real email domain already caught
            continue
        add("UPI", m.group(1), m.start(), m.end(), 0.88)

    # ---- 8. API / secret keys ----
    for m in re.finditer(
        r"\b((?:sk|pk|rk)[_-](?:live|test)[_-][A-Za-z0-9]{16,}| "
        r"(?:api[_-]?key|secret|token|bearer)[_=: ]?[A-Za-z0-9\-_]{16,})\b",
        text,
        re.I,
    ):
        add("API_KEY", m.group(1).strip(), m.start(), m.end(), 0.93)

    # also simple sk_live_... without extra groups
    for m in re.finditer(r"\b(sk_(?:live|test)_[A-Za-z0-9]{16,})\b", text, re.I):
        add("API_KEY", m.group(1), m.start(), m.end(), 0.93)

    # ---- 9. Balance amounts (Rs / INR / ₹) ----
    for m in re.finditer(
        r"(?i)(?:rs\.?|inr|₹)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|"
        r"[0-9]+(?:\.[0-9]{1,2})?)",
        text,
    ):
        add("BALANCE", m.group(0).strip(), m.start(), m.end(), 0.90)

    # ---- 10. Account numbers – only with context or high length ----
    for m in re.finditer(r"(?<!\d)(\d{9,18})(?!\d)", text):
        if overlaps(m.start(), m.end()):
            continue
        val = m.group(1)
        # skip if looks like phone already handled
        if len(val) == 10 and val[0] in "6789":
            continue
        if len(val) == 12 and val.startswith("91") and val[2] in "6789":
            continue
        window = text[max(0, m.start() - 40): m.end() + 15]
        if ACCOUNT_CONTEXT.search(window) or BALANCE_CONTEXT.search(window):
            conf = 0.88
        elif len(val) >= 14:
            conf = 0.70  # long numbers more likely accounts
        else:
            conf = 0.45  # weak – still report but low
        if conf >= 0.45:
            add("ACCOUNT_NO", val, m.start(), m.end(), conf)

    matches.sort(key=lambda x: x.start)
    return matches
