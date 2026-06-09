## Summary

Update the Super Admin dashboard to (1) show **Recent Activities** from **real system logs**, (2) render a **real Kenya counties SVG map** for school distribution, and (3) let admins save **School Location (County + Town)** in School Settings so the dashboard map can plot schools correctly.

## Current State Analysis

### Recent Activities (frontend)
- `frontend/src/pages/SuperAdminDashboard.jsx` currently renders **hardcoded** “Recent Activities” items.
- The backend already exposes **real logs** endpoints used by `frontend/src/pages/SuperAdminLogs.jsx`:
  - `GET /auth/superadmin/logs/delivery/` (delivery logs)
  - `GET /auth/superadmin/logs/system-health/` (system health events)
  - Both responses include `created_at` and basic context fields, so they can be merged into a dashboard feed.

### School Distribution in Kenya (frontend)
- `frontend/src/pages/SuperAdminDashboard.jsx` currently uses a **stylized** Kenya illustration, not a real map.

### School Location input (frontend + backend)
- Admin School Settings page is `frontend/src/pages/AdminSchool.jsx`, backed by `GET/PUT /auth/school/me/` implemented in `backend/accounts/views.py::school_me`.
- `School` model (`backend/accounts/models.py`) currently has `address` but **no county/town fields**.
- `SchoolSerializer` (`backend/accounts/serializers.py`) does not include any location fields beyond `address`.
- Super Admin list endpoint `GET /auth/superadmin/schools/` (`backend/accounts/views.py::superadmin_schools`) does not include location fields beyond `address`.

## Assumptions & Decisions

1. **Recent Activities source:** Use **System logs** (Delivery Logs + System Health) and display the newest merged items on the dashboard.
2. **Location format:** Store **County + Town** (County will be stored as a code aligned to the SVG IDs).
3. **Kenya map rendering:** Use a **real SVG counties map** (Simplemaps “Kenya admin1”) and plot schools by county.
4. **County storage format:** Persist a `county_code` using Simplemaps IDs: `KE01`…`KE47`, plus a free-text `town`.

## Proposed Changes

### A) Backend — persist and expose School location

#### 1) Add fields to the School model
- **File:** `backend/accounts/models.py`
- **Change:** Add two optional fields:
  - `county_code` (CharField, blank, default '', db_index=True) — values like `KE47`
  - `town` (CharField, blank, default '')
- **Why:** Required to store user-entered location used by Super Admin map.

#### 2) Create migration
- **Folder:** `backend/accounts/migrations/`
- **Change:** New migration adding `county_code` and `town` to `School`.
- **Why:** Make DB schema persistent.

#### 3) Update SchoolSerializer
- **File:** `backend/accounts/serializers.py`
- **Change:** Add `county_code` and `town` to `SchoolSerializer.Meta.fields`.
- **Why:** Ensure `/auth/school/me/` can return the saved values and accept updates.

#### 4) Update `school_me` endpoint to save location
- **File:** `backend/accounts/views.py`
- **Function:** `school_me`
- **Change:**
  - Include `county_code` and `town` in `payload`.
  - Add light validation for `county_code` (must be empty or match `KE01`…`KE47`).
- **Why:** Admins save location in School Settings.

#### 5) Update Super Admin schools endpoints to include location
- **File:** `backend/accounts/views.py`
- **Functions:** `superadmin_schools` (GET list), `superadmin_school_detail` (GET + PATCH)
- **Change:**
  - Include `county_code` and `town` in GET responses.
  - Allow PATCH updates (add to allowlist alongside `name, code, address, motto, aim`).
- **Why:** Dashboard can fetch schools and map them without extra endpoints.

### B) Frontend — School Settings UI (County + Town)

#### 1) Add “Location” section to School Settings form
- **File:** `frontend/src/pages/AdminSchool.jsx`
- **Change:**
  - Extend form state with `county_code` and `town`.
  - On load (`GET /auth/school/me/`), populate these fields.
  - On submit, include in FormData:
    - `county_code`
    - `town`
  - UI:
    - `county_code` as a `<select>` with 47 counties.
    - `town` as a text input (free text).
- **Why:** Users can enter their location for mapping.
- **How (data):** Keep a `KENYA_COUNTIES` constant array:
  - `{ code: 'KE47', name: 'Nairobi' }`, etc.
  - Must match Simplemaps map IDs.

### C) Frontend — Recent Activities uses real logs

#### 1) Fetch logs on dashboard mount
- **File:** `frontend/src/pages/SuperAdminDashboard.jsx`
- **Change:**
  - Replace hardcoded `recentActivities` with state + `useEffect` fetching:
    - `/auth/superadmin/logs/delivery/?page=1&page_size=15`
    - `/auth/superadmin/logs/system-health/?page=1&page_size=15`
  - Normalize rows into a single “activity” shape:
    - `id`, `created_at`, `title`, `timeLabel`, `Icon`, `color`
  - Merge arrays, sort by `created_at` desc, slice to 7 items.
- **Why:** “Recent Activities” must display real system activity.
- **Icons/labels:** Use `lucide-react` icons (already in repo) based on `ok`, `channel`, `component`.

### D) Frontend — Real Kenya SVG counties map + plot schools

#### 1) Add Kenya counties SVG asset
- **Location:** `frontend/src/assets/maps/ke-admin1.svg` (or similar)
- **Source:** Simplemaps Kenya admin1 download URL (licensed “Free for Commercial and Personal Use”; attribution appreciated).
- **Why:** Real Kenya outline and counties are required.

#### 2) Render SVG inline and compute county centroids at runtime
- **File:** `frontend/src/pages/SuperAdminDashboard.jsx`
- **Change:**
  - Replace the current stylized map card content with:
    - Inline SVG markup (or import SVG as raw string and inject via `dangerouslySetInnerHTML`).
  - After render, compute centroids per county path using:
    - `document.querySelector('#ke-map')...`
    - `path.getBBox()` => `{ x, y, width, height }` => centroid `(cx, cy)`.
  - Group schools by `county_code` from `/auth/superadmin/schools/`.
  - For each school, place a dot near the county centroid with small deterministic jitter to avoid overlap.
  - Tooltip on hover:
    - County name
    - List schools (name + town)
- **Why:** Accurate plotting without maintaining a separate centroid dataset.

#### 3) County highlighting and legend
- **File:** `frontend/src/pages/SuperAdminDashboard.jsx`
- **Change:**
  - Fill county shapes based on number of schools in that county (light choropleth).
  - Keep a legend list (e.g., top 4 counties by school count) to match the dashboard’s feel.

## Verification Steps

### Backend
1. Run migrations.
2. Confirm `School` now has `county_code` and `town`.
3. `GET /auth/school/me/` returns `county_code` and `town`.
4. `PUT /auth/school/me/` updates `county_code` and `town` and persists.
5. `GET /auth/superadmin/schools/` includes `county_code` and `town`.

### Frontend
1. Admin → School Settings:
   - Set County + Town, save, refresh, confirm persistence.
2. Super Admin Dashboard:
   - Recent Activities shows real merged logs (compare to `/superadmin/logs`).
   - Kenya map renders a real county outline.
   - Schools appear plotted in the correct county after locations are set.

## Sources
- Simplemaps Kenya SVG maps + license + county IDs (`KE01`–`KE47`): https://simplemaps.com/svg/country/ke
- Simplemaps Kenya admin1 SVG download: https://simplemaps.com/static/svg/country/ke/admin1/ke.svg
