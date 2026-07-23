# Eyevengers Optical — Store Management & Billing Application

A premium management, point-of-sale, and billing application designed for optical stores.

## Project Structure

- **`client/`**: React + Vite + TailwindCSS frontend application.
- **`server/`**: Node.js + Express backend service. Acts as the primary backend powering the application.
- **`backend/`**: An alternative Prisma + PostgreSQL backend scaffold (work-in-progress, not active).

---

## Database Architecture

The application features a hybrid database adapter inside the **`server`** codebase that dynamically connects to the target database:

1. **Supabase PostgreSQL (Production / Persistent)**
   - Powered by a free Supabase PostgreSQL cloud database.
   - Configured via the `DATABASE_URL` environment variable.
   - Includes automatic query translation from SQLite syntax to PostgreSQL (translating date operations, transaction bindings, data types, and parameter formats on the fly).
   - Guarantees complete data persistence across server restarts and Render spin-downs.

2. **Local SQLite (Development Fallback)**
   - Default fallback when `DATABASE_URL` is not specified in the environment.
   - Stores data in a local SQLite file (`server/database.sqlite`).
   - Perfect for quick offline local testing and development.

---

## Environment Configuration

Create a `.env` file inside the `server/` directory to configure the database connection:

```env
DATABASE_URL="postgresql://postgres.upkgwbpojhvalpbyxiae:Heygoogle154%40123@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
```

*Note: In the PostgreSQL connection string, any `@` character in the database password must be URL-encoded as `%40`.*

---

## Running the Application Locally

1. **Install Dependencies:**
   Run the bootstrap script from the project root:
   ```bash
   npm run bootstrap
   ```

2. **Start Development Servers:**
   Run the dev command from the project root to concurrently start the client (port 3000) and server (port 5000):
   ```bash
   npm run dev
   ```

---

## Production Deployment

### Backend (Render)
The backend is configured for deployment on Render. 
- Deployment is controlled by the [render.yaml](render.yaml) file at the root.
- The `DATABASE_URL` env variable is defined in the Render dashboard or blueprint settings to hook the live app up to the Supabase database.

### Frontend (Vercel / Netlify)
The frontend builds into static assets and is deployed on Vercel (configured via `vercel.json` in root and `client/`) or Netlify (`netlify.toml`).
