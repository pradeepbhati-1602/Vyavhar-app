# EYEVENGERS OPTICAL — API CONTRACT DOCUMENT (Phase 0 Output)

> **Source of truth:** Every endpoint, field name, and response shape below was extracted directly from the React frontend source code in `client/src/`. Where the frontend uses a field name, that exact name is used here.

---

## 1. BASE CONFIGURATION

| Setting | Value | Source |
|---|---|---|
| **Proxy target (backend)** | `http://localhost:5000` | [vite.config.js](file:///c:/Users/LENOVO/Desktop/eyevengers%20app/client/vite.config.js) |
| **API base path** | `/api/` (no version prefix) | All `fetch()` calls use `/api/...` |
| **Static file paths** | `/invoices/`, `/prescriptions/` | Vite proxy config + usage in components |
| **Auth token storage** | `localStorage.getItem('token')` | Every component |
| **Auth header format** | `Authorization: Bearer <token>` | Every component |
| **Error response format** | `{ error: "message string" }` | Checked via `data.error` in all catch blocks |
| **CORS origin** | `localhost:3000` (Vite dev) | Implicit — backend must allow this |

---

## 2. AUTHENTICATION

### 2.1 Login
**Source:** [Login.jsx](file:///c:/Users/LENOVO/Desktop/eyevengers%20app/client/src/pages/Login.jsx) L22-39

| | |
|---|---|
| **Endpoint** | `POST /api/auth/login` |
| **Request body** | `{ username: string, password: string }` |
| **Success response** | `{ token: string, user: { name: string, role: string } }` |
| **Error response** | `{ error: string }` (HTTP 4xx) |
| **Frontend action** | Stores `data.token` in `localStorage`, calls `onLoginSuccess(data.user)` |

> **Note on `role`:** Frontend checks `user.role === 'Owner'` (capitalized) for Settings access and product discontinuation. Role values must be `'Owner'` and `'Employee'`.

### 2.2 Token Verification (Session Restore)
**Source:** [App.jsx](file:///c:/Users/LENOVO/Desktop/eyevengers%20app/client/src/App.jsx) L252-273

| | |
|---|---|
| **Endpoint** | `GET /api/auth/verify` |
| **Headers** | `Authorization: Bearer <token>` |
| **Success response** | `{ user: { name: string, role: string } }` |
| **Failure** | Any non-OK status → clears localStorage token |

---

## 3. DASHBOARD

### 3.1 Main Dashboard Metrics
**Source:** [Dashboard.jsx](file:///c:/Users/LENOVO/Desktop/eyevengers%20app/client/src/pages/Dashboard.jsx) L22-54

| | |
|---|---|
| **Endpoint** | `GET /api/dashboard` |
| **Success response** | Object with two top-level keys: `metrics` and `charts` |

**`metrics` shape:**
```json
{
  "metrics": {
    "today": { "revenue": number, "bills": number },
    "monthly": { "revenue": number, "bills": number },
    "overall": { "customers": number, "avgBill": number, "bills": number }
  },
  "charts": {
    "revenueTrend": [ { "day": string, "sales": number }, ... ],
    "categorySplit": [ { "name": string, "value": number }, ... ]
  }
}
```

- `revenueTrend` → Last 7 days, each item has `day` (label) and `sales` (amount)
- `categorySplit` → PieChart data, each item has `name` (category name) and `value` (sales amount)

### 3.2 Today's Birthdays
**Source:** Dashboard.jsx L33-35

| | |
|---|---|
| **Endpoint** | `GET /api/customers/birthdays` |
| **Response** | Array of: `{ customer_id: string, name: string, mobile: string }` |

### 3.3 Low Stock Products
**Source:** Dashboard.jsx L38-39

| | |
|---|---|
| **Endpoint** | `GET /api/products/low-stock` |
| **Response** | Array of: `{ product_id: string, brand: string, frame_name: string, category: string, current_stock: number }` |

### 3.4 Repairs (filtered in Dashboard)
**Source:** Dashboard.jsx L43-47

| | |
|---|---|
| **Endpoint** | `GET /api/repairs` |
| **Response** | Array of repair objects (see §10 below) |
| **Client-side filter** | `r.repair_status === 'Ready' && r.delivery_status !== 'Delivered'` |

---

## 4. CUSTOMERS

### 4.1 Customer List (Directory)
**Source:** [Customers.jsx](file:///c:/Users/LENOVO/Desktop/eyevengers%20app/client/src/pages/Customers.jsx) L31-46

| | |
|---|---|
| **Endpoint** | `GET /api/customers?search={query}&sortBy={field}&order={asc|desc}` |
| **Query params** | `search` (name or mobile), `sortBy` (field name), `order` (`asc`/`desc`) |
| **Response** | Array of customer summary objects |

**Customer list item fields used:**
```
customer_id, name, mobile, total_purchase
```

### 4.2 Customer Full Profile
**Source:** Customers.jsx L48-61

| | |
|---|---|
| **Endpoint** | `GET /api/customers/:id` |
| **Response** | Nested object with: `customer`, `bills`, `eyeTests`, `repairs` |

**Full response shape:**
```json
{
  "customer": {
    "name": string,
    "mobile": string,
    "total_purchase": number,
    "total_bills": number,
    "current_cashback": number,
    "last_visit": string (ISO date or null),
    "birthday": string (ISO date or null),
    "gender": string,
    "language": string,
    "referral_code_used": string | null,
    "address": string | null
  },
  "bills": [
    {
      "bill_id": string,
      "created_at": string,
      "brand": string,
      "frame_name": string | null,
      "total_amount": number,
      "due_amount": number
    }
  ],
  "eyeTests": [
    {
      "eyetest_id": string,
      "vision_category": string,
      "created_at": string,
      "re_sph": number,
      "le_sph": number,
      "prescription_pdf_url": string | null
    }
  ],
  "repairs": [
    {
      "repair_id": string,
      "frame_details": string,
      "expected_date": string,
      "repair_type": string,
      "charges": number,
      "repair_status": string
    }
  ]
}
```

> **CRITICAL:** The bill items inside the profile include `brand` and `frame_name` — these must be JOINed from the products table.
> **CRITICAL:** Invoice PDFs are accessed at `/invoices/{bill_id}.pdf`

### 4.3 Customer Lookup by Mobile (Live Billing Lookup)
**Source:** [NewBill.jsx](file:///c:/Users/LENOVO/Desktop/eyevengers%20app/client/src/pages/NewBill.jsx) L103-121

| | |
|---|---|
| **Endpoint** | `GET /api/customers/lookup/:mobile` |
| **Success response (200)** | `{ customer: { name, birthday, gender, address, language, current_cashback } }` |
| **Not found** | Non-200 status → no error handling, simply doesn't fill form |

### 4.4 Referral Code Lookup (Live Validation)
**Source:** NewBill.jsx L133-151

| | |
|---|---|
| **Endpoint** | `GET /api/customers/referral/:code` |
| **Success (200)** | `{ customer_name: string }` |
| **Not found** | `{ error: string }` (non-OK status) |

---

## 5. PRODUCTS & INVENTORY

### 5.1 Product List (Filtered)
**Source:** [Inventory.jsx](file:///c:/Users/LENOVO/Desktop/eyevengers%20app/client/src/pages/Inventory.jsx) L34-48

| | |
|---|---|
| **Endpoint** | `GET /api/products?category={cat}&search={query}&lowStock={true}` |
| **Response** | Array of product objects |

**Product object fields used:**
```
product_id, barcode, category, brand, frame_name, frame_color, size,
selling_price, purchase_price, current_stock, low_stock_limit, opening_stock, supplier
```

> **⚠️ NAMING MISMATCH with Prisma schema:** The frontend uses `frame_name`, `frame_color`, `low_stock_limit`. The Prisma schema uses `product_name`, `color`, `low_stock_alert`. **The backend must map Prisma fields to match the frontend field names in API responses.**

### 5.2 Add Product
**Source:** Inventory.jsx L60-92

| | |
|---|---|
| **Endpoint** | `POST /api/products` |
| **Request body** | (see below) |
| **Success (200)** | Product object |
| **Error** | `{ error: string }` |

**Request payload:**
```json
{
  "barcode": string,
  "category": string,       // e.g. "Frames", "Sunglasses", etc. — use the display string, NOT the ENUM
  "brand": string,
  "frame_name": string,     // ⚠️ Prisma: product_name
  "frame_color": string,    // ⚠️ Prisma: color
  "size": string,
  "purchase_price": number,
  "selling_price": number,
  "opening_stock": number,
  "low_stock_limit": number, // ⚠️ Prisma: low_stock_alert
  "supplier": string         // ⚠️ Prisma: supplier_name
}
```

### 5.3 Discontinue Product
**Source:** Inventory.jsx L95-111

| | |
|---|---|
| **Endpoint** | `DELETE /api/products/:id` |
| **Success** | HTTP 200 |
| **Error** | `{ error: string }` |

### 5.4 Barcode Lookup (Quick Scan)
**Source:** NewBill.jsx L154-179

| | |
|---|---|
| **Endpoint** | `GET /api/products/barcode/:barcode` |
| **Success** | Single product object with fields: `product_id, category, brand, frame_name, selling_price, frame_color, size, current_stock` |
| **Not found** | Non-OK status |

### 5.5 Filtered Products for Billing
**Source:** NewBill.jsx L81-91 (Frames), SunglassesBilling.jsx L35-45 (Sunglasses)

| | |
|---|---|
| **Endpoint** | `GET /api/products?category=Frames` or `GET /api/products?category=Sunglasses` |
| **Response** | Array of product objects |
| **Product fields used in dropdowns** | `product_id, brand, frame_name, frame_color, current_stock, selling_price, size` |

---

## 6. BILLS (CORE ENGINE)

### 6.1 Create Bill
**Source:** [NewBill.jsx](file:///c:/Users/LENOVO/Desktop/eyevengers%20app/client/src/pages/NewBill.jsx) L232-293, [SunglassesBilling.jsx](file:///c:/Users/LENOVO/Desktop/eyevengers%20app/client/src/pages/SunglassesBilling.jsx) L167-207

| | |
|---|---|
| **Endpoint** | `POST /api/bills` |
| **Request body** | (see below) |
| **Success (200)** | `{ billId, pdfUrl, waLink, toast }` |
| **Error** | `{ error: string }` |

**Request payload (Regular Bill — NewBill.jsx):**
```json
{
  "name": string,
  "mobile": string,
  "birthday": string,
  "gender": string,
  "address": string,
  "language": string,
  "referral_code": string | null,
  "frame_product_id": string | null,
  "lens_details": {
    "type": string,
    "coating": string,
    "price": number
  },
  "power_details": {
    "re_sph": string,
    "re_cyl": string,
    "re_axis": string,
    "le_sph": string,
    "le_cyl": string,
    "le_axis": string,
    "pd": string,
    "add": string
  },
  "subtotal": number,
  "discount": number,
  "cashback_used": number,
  "advance_paid": number
}
```

**Request payload (Sunglasses Bill — SunglassesBilling.jsx):**
```json
{
  "name": string,
  "mobile": string,
  "referral_code": string | null,
  "frame_product_id": string,
  "lens_details": null,
  "power_details": null,
  "subtotal": number,
  "discount": number,
  "cashback_used": number,
  "advance_paid": number
}
```

> **Note:** Sunglasses billing omits `birthday`, `gender`, `address`, `language`. Backend should handle these as optional. When `lens_details` is null → bill_type should be `'Sunglasses'`.

**Success response:**
```json
{
  "billId": string,          // Invoice number displayed to user
  "pdfUrl": string,          // URL to open in new tab (auto-opened)
  "waLink": string,          // WhatsApp wa.me link
  "toast": string            // Toast notification message
}
```

### 6.2 List All Bills
**Source:** [Reports.jsx](file:///c:/Users/LENOVO/Desktop/eyevengers%20app/client/src/pages/Reports.jsx) L16-28

| | |
|---|---|
| **Endpoint** | `GET /api/bills` |
| **Response** | Array of bill objects |

**Bill list item fields used:**
```
bill_id, customer_name, customer_mobile, subtotal, discount, cashback_used,
advance_paid, due_amount, total_amount, payment_status, bill_status, created_at
```

> **CRITICAL:** The bill list includes `customer_name` and `customer_mobile` — these must be JOINed/included from the customers table.

---

## 7. EYE TESTS

### 7.1 Save Eye Test / Prescription
**Source:** [EyeTest.jsx](file:///c:/Users/LENOVO/Desktop/eyevengers%20app/client/src/pages/EyeTest.jsx) L51-106

| | |
|---|---|
| **Endpoint** | `POST /api/eyetests` |
| **Request body** | (see below) |
| **Success (200)** | `{ pdfUrl, waLink, toast }` |
| **Error** | `{ error: string }` |

**Request payload:**
```json
{
  "patient_name": string,
  "mobile": string,
  "age": number | null,
  "vision_category": string,
  "re_sph": number,
  "re_cyl": number,
  "re_axis": number | null,
  "le_sph": number,
  "le_cyl": number,
  "le_axis": number | null,
  "pd": number | null,
  "add_power": number | null,
  "doctor_notes": string
}
```

**Success response:**
```json
{
  "pdfUrl": string,
  "waLink": string,
  "toast": string
}
```

### 7.2 List Eye Tests
**Source:** EyeTest.jsx L37-49

| | |
|---|---|
| **Endpoint** | `GET /api/eyetests` |
| **Response** | Array of eye test objects |

**Eye test list item fields:**
```
eyetest_id, patient_name, mobile, age, vision_category,
re_sph, re_cyl, le_sph, le_cyl, re_axis, le_axis,
pd, add_power, prescription_pdf_url
```

### 7.3 Convert to Bill (client-side navigation only)
**Source:** EyeTest.jsx L108-127

This is **NOT an API call** — it navigates to `/new-bill` with state. No backend endpoint needed for the conversion navigation itself. (The original prompt's `POST /eye-tests/:id/convert-to-bill` is NOT wired in the frontend.)

---

## 8. REFERRAL MEMBERS

### 8.1 List All Referral Members
**Source:** [Referrals.jsx](file:///c:/Users/LENOVO/Desktop/eyevengers%20app/client/src/pages/Referrals.jsx) L16-28

| | |
|---|---|
| **Endpoint** | `GET /api/customers/referrals/all` |
| **Response** | Array of referral member objects |

**Referral member fields:**
```
referral_id, customer_name, mobile, referral_code,
referral_count, cashback_earned, cashback_used, status
```

> Note: `cashback_balance` is computed client-side as `cashback_earned - cashback_used`

### 8.2 Register New Referral Member
**Source:** Referrals.jsx L30-59

| | |
|---|---|
| **Endpoint** | `POST /api/customers/referrals` |
| **Request body** | `{ customer_name: string, mobile: string }` |
| **Success** | Referral member object |
| **Error** | `{ error: string }` |

> Backend should auto-generate sequential `referral_code` (e.g. `EYE1001`, `EYE1002`...)

### 8.3 Toggle Referral Member Status
**Source:** Referrals.jsx L62-79

| | |
|---|---|
| **Endpoint** | `PUT /api/customers/referrals/:id/status` |
| **Request body** | `{ status: "Active" | "Inactive" }` |
| **Success** | HTTP 200 |

---

## 9. SETTINGS

### 9.1 Get Settings
**Source:** [Settings.jsx](file:///c:/Users/LENOVO/Desktop/eyevengers%20app/client/src/pages/Settings.jsx) L33-51

| | |
|---|---|
| **Endpoint** | `GET /api/settings` |
| **Response** | Object with key-value pairs |

**Settings fields used:**
```
store_name, gst_number, store_address, store_mobile,
referral_cashback_percent, inactive_customer_days, low_stock_limit
```

### 9.2 Save Settings
**Source:** Settings.jsx L65-95

| | |
|---|---|
| **Endpoint** | `POST /api/settings` |
| **Request body** | Same keys as above |
| **Success** | HTTP 200 |
| **Error** | Exception |

### 9.3 List Employees
**Source:** Settings.jsx L53-63

| | |
|---|---|
| **Endpoint** | `GET /api/settings/users` |
| **Response** | Array of user objects |

**User list item fields:**
```
user_id, name, username, role
```

### 9.4 Create Employee Account
**Source:** Settings.jsx L97-131

| | |
|---|---|
| **Endpoint** | `POST /api/settings/users` |
| **Request body** | `{ username: string, password: string, name: string, role: string }` |
| **Success** | User object |
| **Error** | `{ error: string }` |

---

## 10. REPAIR ORDERS

### 10.1 List Repairs
**Source:** [Repairs.jsx](file:///c:/Users/LENOVO/Desktop/eyevengers%20app/client/src/pages/Repairs.jsx) L27-39

| | |
|---|---|
| **Endpoint** | `GET /api/repairs` |
| **Response** | Array of repair objects |

**Repair object fields:**
```
repair_id, customer_name, customer_mobile, frame_details,
repair_type, charges, expected_date, repair_status, delivery_status
```

> **CRITICAL:** Includes `customer_name` and `customer_mobile` — must be JOINed from customers table.

### 10.2 Create Repair Order
**Source:** Repairs.jsx L41-79

| | |
|---|---|
| **Endpoint** | `POST /api/repairs` |
| **Request body** | (see below) |
| **Success** | `{ customer_name: string, ...repair_data }` |
| **Error** | `{ error: string }` |

**Request payload:**
```json
{
  "customer_name": string,
  "mobile": string,
  "frame_details": string,
  "repair_type": string,
  "charges": number,
  "expected_date": string (date)
}
```

### 10.3 Update Repair Status
**Source:** Repairs.jsx L81-106

| | |
|---|---|
| **Endpoint** | `PUT /api/repairs/:id/status` |
| **Request body** | `{ repair_status: string }` |
| **Success** | `{ toast: string, waLink: string | null }` |
| **Error** | `{ error: string }` |

**Valid status transitions:** `Received → In Progress → Ready → Delivered`

> When status becomes `"Ready"`, the response should include a `waLink` (WhatsApp deep link to notify customer). Frontend auto-opens it.

---

## 11. REPORTS (CSV Exports)

**Source:** [Reports.jsx](file:///c:/Users/LENOVO/Desktop/eyevengers%20app/client/src/pages/Reports.jsx) L31-128

The Reports page re-uses existing endpoints to fetch data and generates CSVs client-side. No additional backend endpoints needed. The endpoints re-used:

| Report | API Endpoint | Fields used |
|---|---|---|
| Sales Ledger | `GET /api/bills` | `bill_id, customer_name, customer_mobile, subtotal, discount, cashback_used, advance_paid, due_amount, total_amount, payment_status, bill_status, created_at` |
| Customers Registry | `GET /api/customers` | `customer_id, name, mobile, birthday, gender, language, total_bills, total_purchase, current_cashback, last_visit` |
| Inventory Catalog | `GET /api/products` | `product_id, barcode, category, brand, frame_name, frame_color, size, purchase_price, selling_price, current_stock, low_stock_limit` |

---

## 12. WHATSAPP INTEGRATION

WhatsApp is handled **entirely client-side** via `wa.me` deep links. No backend WhatsApp endpoint exists in the frontend code. The backend provides WhatsApp deep links in certain responses:

| Context | Response field | Generated by |
|---|---|---|
| Bill creation | `data.waLink` | Backend constructs `wa.me` link |
| Eye test | `data.waLink` | Backend constructs `wa.me` link |
| Repair status → Ready | `data.waLink` | Backend constructs `wa.me` link |
| Birthday wishes | N/A | Client-side construction (Dashboard.jsx L76-85) |
| Customer chat/promo | N/A | Client-side construction (Customers.jsx L73-87) |

---

## 13. STATIC FILE SERVING

| Path | Purpose | Source |
|---|---|---|
| `/invoices/{bill_id}.pdf` | Invoice PDF downloads | Customers.jsx L262 |
| `/prescriptions/...` | Prescription PDF downloads | Vite proxy config |

Backend must serve generated PDFs from these paths.

---

## 14. FIELD NAMING MISMATCHES — PRISMA vs. FRONTEND

> **CRITICAL SECTION:** The Prisma schema already exists at `backend/prisma/schema.prisma` and uses different field names from what the frontend expects. The backend's API response layer **MUST map** Prisma field names to frontend field names.

| Frontend field name | Prisma model field | Used in |
|---|---|---|
| `frame_name` | `product_name` | Products everywhere |
| `frame_color` | `color` | Products everywhere |
| `low_stock_limit` | `low_stock_alert` | Products, inventory |
| `supplier` | `supplier_name` | Add product |
| `user_id` | `id` | Users |
| `customer_id` | `id` | Customers |
| `product_id` | `id` | Products |
| `bill_id` | `id` / `invoice_number` | Bills (displayed as ID) |
| `eyetest_id` | `id` | Eye tests |
| `repair_id` | `id` | Repairs |
| `referral_id` | `id` | Referral members |
| `customer_name` (in bills) | Joined from Customer.name | Bills list |
| `customer_mobile` (in bills) | Joined from Customer.mobile | Bills list |
| `customer_name` (in repairs) | Joined from Customer.name | Repairs list |
| `customer_mobile` (in repairs) | Joined from Customer.mobile | Repairs list |
| `brand` + `frame_name` (in bill profile) | Joined from Product | Customer profile bills |

### Category Values Mismatch
| Frontend string | Prisma enum |
|---|---|
| `'Frames'` | `FRAMES` |
| `'Contact Lens'` | `CONTACT_LENS` |
| `'Reading Glasses'` | `READING_GLASSES` |
| `'Sunglasses'` | `SUNGLASSES` |
| `'Accessories'` | `ACCESSORIES` |
| `'Lens'` | `LENS` |
| `'Repair Parts'` | `REPAIR_PARTS` |

### Other Enum Mismatches
| Frontend value | Prisma enum |
|---|---|
| `'Owner'` | `OWNER` |
| `'Employee'` | `EMPLOYEE` |
| `'Male'` | `MALE` |
| `'Female'` | `FEMALE` |
| `'Other'` | `OTHER` |
| `'Hindi'` | `HINDI` |
| `'English'` | `ENGLISH` |
| `'Paid'` | `PAID` |
| `'Partial'` | `PARTIAL` |
| `'Due'` | `DUE` |
| `'Pending'` | `PENDING` |
| `'Delivered'` | `DELIVERED` |
| `'Active'` | `ACTIVE` |
| `'Cancelled'` | `CANCELLED` |
| `'Regular'` | `REGULAR` |
| `'Sunglasses'` | `SUNGLASSES` |
| `'Received'` | `RECEIVED` |
| `'In Progress'` | `IN_PROGRESS` |
| `'Ready'` | `READY` |
| `'Active'` / `'Inactive'` | `ACTIVE` / `INACTIVE` |

> **Backend must expose display-friendly string values (e.g., `'Frames'`, `'Owner'`, `'In Progress'`) in all API responses, and must accept these display strings in request bodies. Internally convert to/from Prisma enums in the service/controller layer.**

---

## 15. AUTHENTICATION MODEL

| | |
|---|---|
| **Login field** | `username` (not email or mobile) |
| **Prisma User model** | Has `email` and `mobile` but **no `username`** field |
| **Frontend expectation** | Login with `username` + `password`, user object has `name` + `role` |

> **⚠️ SCHEMA CHANGE REQUIRED:** The Prisma `User` model needs a `username` field added (unique). The existing schema has `email` and `mobile` but the frontend only uses `username` for login. Either:
> - Add `username String @unique` to the User model (recommended), OR
> - Use `email` as the username field (but this would be semantically wrong)

---

## 16. COMPLETE ENDPOINT SUMMARY

| # | Method | Path | Screen | Wired? |
|---|---|---|---|---|
| 1 | POST | `/api/auth/login` | Login | ✅ Real API call |
| 2 | GET | `/api/auth/verify` | App (on load) | ✅ Real API call |
| 3 | GET | `/api/dashboard` | Dashboard | ✅ Real API call |
| 4 | GET | `/api/customers/birthdays` | Dashboard | ✅ Real API call |
| 5 | GET | `/api/products/low-stock` | Dashboard | ✅ Real API call |
| 6 | GET | `/api/customers?search=&sortBy=&order=` | Customers | ✅ Real API call |
| 7 | GET | `/api/customers/:id` | Customers Profile | ✅ Real API call |
| 8 | GET | `/api/customers/lookup/:mobile` | NewBill, Sunglasses | ✅ Real API call |
| 9 | GET | `/api/customers/referral/:code` | NewBill, Sunglasses | ✅ Real API call |
| 10 | GET | `/api/products?category=&search=&lowStock=` | Inventory, NewBill, Sunglasses | ✅ Real API call |
| 11 | POST | `/api/products` | Inventory (Add) | ✅ Real API call |
| 12 | DELETE | `/api/products/:id` | Inventory (Discontinue) | ✅ Real API call |
| 13 | GET | `/api/products/barcode/:barcode` | NewBill, Sunglasses | ✅ Real API call |
| 14 | POST | `/api/bills` | NewBill, Sunglasses | ✅ Real API call |
| 15 | GET | `/api/bills` | Reports | ✅ Real API call |
| 16 | POST | `/api/eyetests` | Eye Test | ✅ Real API call |
| 17 | GET | `/api/eyetests` | Eye Test | ✅ Real API call |
| 18 | GET | `/api/repairs` | Repairs, Dashboard | ✅ Real API call |
| 19 | POST | `/api/repairs` | Repairs (Add) | ✅ Real API call |
| 20 | PUT | `/api/repairs/:id/status` | Repairs (Status) | ✅ Real API call |
| 21 | GET | `/api/customers/referrals/all` | Referrals | ✅ Real API call |
| 22 | POST | `/api/customers/referrals` | Referrals (Register) | ✅ Real API call |
| 23 | PUT | `/api/customers/referrals/:id/status` | Referrals (Toggle) | ✅ Real API call |
| 24 | GET | `/api/settings` | Settings | ✅ Real API call |
| 25 | POST | `/api/settings` | Settings (Save) | ✅ Real API call |
| 26 | GET | `/api/settings/users` | Settings (List users) | ✅ Real API call |
| 27 | POST | `/api/settings/users` | Settings (Add user) | ✅ Real API call |

> **All 27 endpoints above are real wired `fetch()` calls in the frontend.** There is no mock/dummy data anywhere — every screen makes live API calls.

---

## 17. ENDPOINTS FROM THE PROMPT THAT ARE NOT IN THE FRONTEND

The following endpoints from the user's Phase 2/3 prompt are **NOT wired in the frontend** and should be built as backend-only capabilities (useful for future features or admin tools):

| Endpoint | Notes |
|---|---|
| `POST /api/auth/register` | No registration screen — only seed/admin |
| `PUT /api/customers/:id` | No edit customer screen exists |
| `POST /api/products/:id/edit-stock` | No stock edit UI exists |
| `GET /api/products/:id/history` | No inventory history view |
| `PUT /api/bills/:id/cancel` | No cancel bill button in UI |
| `PUT /api/bills/:id/deliver` | No delivery management screen |
| `GET /api/bills/undelivered` | No undelivered view |
| `GET /api/bills/delivered-history` | No delivered history view |
| `GET /api/bills/:id` | No single bill detail view |
| `GET /api/bills/:id/invoice` | Invoice served as static file instead |
| `POST /api/whatsapp/send` | WhatsApp handled client-side |
| `GET /api/dashboard/today` etc. | All combined into single `/api/dashboard` |
| `GET /api/search?q=` | No global search bar in UI |
| `POST /api/eye-tests/:id/convert-to-bill` | Conversion is client-side navigation |
| `GET /api/referrals` | Frontend uses `/api/customers/referrals/all` |
| `GET /api/referrals/:code` | Frontend uses `/api/customers/referral/:code` |

> **Recommendation:** Build the 27 wired endpoints first. The additional endpoints can be added later when the frontend evolves.
