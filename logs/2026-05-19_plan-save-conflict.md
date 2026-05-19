# Session plan — 2026-05-19 (Fix: Save conflict on Settings identity save)

## Root cause
Two bugs in github.ts:

1. `loadEncFile` catch block returns `sha: null` if decryption throws — so the
   SHA is silently lost even though the file exists on GitHub. Next save tries
   to write with sha=null → GitHub 422 → "Save conflict".

2. `ghPut` has no retry — any SHA mismatch (stale session, two tabs, crypto
   error on load) is immediately fatal to the user.

## Fix

### github.ts — loadEncFile
- [x] Capture `sha` from ghGet BEFORE decryptObjWithToken call
- [x] Return `{ data: defaultValue, sha }` in the catch block instead of `sha: null`
- [x] SHA is now preserved even when decryption fails

### github.ts — ghPut
- [x] On 409/422: fetch current SHA via ghGet, swap it into body, retry PUT once
- [x] If retry also fails → throw the original conflict message
- [x] If file is missing on retry → throw specific message
