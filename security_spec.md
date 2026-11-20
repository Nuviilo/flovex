# Flovex Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity Integrity**: A `ShareFile` or `FileChunk` can only be created or deleted by an authenticated, email-verified user whose `request.auth.uid` matches `uploaderId`.
2. **Zero Enumeration / No Blanket List**: Unauthenticated users or other users cannot `list` the `/shares` collection or `/shares/{shareId}/chunks` subcollection. Only the authenticated uploader can `list` their own shares (`resource.data.uploaderId == request.auth.uid`).
3. **Capability-Based Retrieval with Expiration**: Any recipient who possesses the exact `shareId` may `get` `/shares/{shareId}` and `/shares/{shareId}/chunks/{chunkId}` only when `revoked == false` and `expiresAt > request.time`.
4. **Master Gate Sync**: Every chunk read or write verifies the parent `/shares/{shareId}` document via `exists()` and `get()`.
5. **Terminal State Lock**: Once `revoked` is set to `true`, the `ShareFile` cannot be un-revoked or modified.
6. **Temporal Integrity**: `createdAt` must equal `request.time` on creation, and `expiresAt` must be strictly in the future and at most 31 days out.
7. **Volumetric Bounds**: File size is capped at 15 MiB (`15728640` bytes), chunks at `<= 700000` characters, and chunk counts at `<= 35`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Create**: Creating `/shares/flx-abc123` with `uploaderId: "other-user-uid"`. -> `PERMISSION_DENIED`
2. **Unverified Email Write**: Authenticated user with `email_verified: false` attempting `create` on `/shares/flx-abc123`. -> `PERMISSION_DENIED`
3. **Shadow Field Injection**: Creating `/shares/flx-abc123` with an extra field `isAdmin: true`. -> `PERMISSION_DENIED`
4. **Path ID Poisoning**: Creating or getting `/shares/bad$id!with*spaces` or a 200-char ID. -> `PERMISSION_DENIED`
5. **Client Timestamp Forgery**: Creating `/shares/flx-abc123` with `createdAt` backdated by 5 days. -> `PERMISSION_DENIED`
6. **Infinite Expiry Bypass**: Creating `/shares/flx-abc123` with `expiresAt` 10 years in the future. -> `PERMISSION_DENIED`
7. **Expired Share Retrieval**: Unauthenticated `get` on `/shares/flx-expired` where `expiresAt < request.time`. -> `PERMISSION_DENIED`
8. **Revoked Share Retrieval**: Unauthenticated `get` on `/shares/flx-revoked` where `revoked == true`. -> `PERMISSION_DENIED`
9. **Blanket Collection Scraping**: Running `list` on `/shares` without `where('uploaderId', '==', uid)` or while unauthenticated. -> `PERMISSION_DENIED`
10. **Orphan Chunk Creation**: Creating `/shares/nonexistent/chunks/0` without a parent `ShareFile` owned by the caller. -> `PERMISSION_DENIED`
11. **Terminal State Resurrection**: Updating a `ShareFile` with `revoked: true` back to `revoked: false`. -> `PERMISSION_DENIED`
12. **Immutable Field Mutation**: Updating `fileName` or `fileSize` on an existing `ShareFile`. -> `PERMISSION_DENIED`
