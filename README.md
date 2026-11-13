# ENAKO Ecosystem Monorepo

Unified Monorepo housing the core services and client applications of the ENAKO Cloud platform.

---

## 📁 Repository Structure

```text
enako-ecosystem/
├── .github/
│   └── workflows/
│       └── dev-ci-cd.yml      # Automated change detection, test & build pipeline
├── apps/
│   ├── backend/               # NestJS & Prisma REST API
│   ├── enako-os/              # Main Operations & Management Dashboard (Vite + React)
│   ├── cash/                  # Cash Collections & Field Agent Stream (Vite + React)
│   └── kyc/                   # Client KYC & Compliance Portal (Vite + React)
├── package.json               # Monorepo root workspace configuration
└── .gitignore
```

---

## 🚀 Local Development

Each service can be run individually or together from the root using npm workspaces.

### 1. Install Dependencies
Run `npm install` in each app or at the root:
```bash
npm install
```

### 2. Service Ports & Commands

| Service | Path | Default Port | Dev Command (from root) |
| :--- | :--- | :--- | :--- |
| **Backend API** | `apps/backend` | `http://localhost:4000` | `npm run dev:backend` |
| **Enako OS** | `apps/enako-os` | `http://localhost:3000` | `npm run dev:enako-os` |
| **Cash Dashboard** | `apps/cash` | `http://localhost:3003` | `npm run dev:cash` |
| **KYC Portal** | `apps/kyc` | `http://localhost:5173` | `npm run dev:kyc` |

---

## 🛠️ Workspaces Scripts

From the root `enako-ecosystem` folder:

- **Build all applications:**
  ```bash
  npm run build
  ```
- **Lint all applications:**
  ```bash
  npm run lint
  ```
- **Test all applications:**
  ```bash
  npm run test
  ```

---

## 🔄 CI/CD Pipeline (`dev-ci-cd.yml`)

The GitHub Actions workflow triggers on pushes and pull requests to `dev`, `develop`, and `main`:

1. **Selective Change Detection:** Uses `dorny/paths-filter` to identify which apps have changes, running tests and builds only for the services that were modified.
2. **Backend CI:** Installs dependencies, runs `npx prisma generate`, typechecks, and builds the NestJS application.
3. **Frontend Matrix CI:** Runs parallel linting and production builds for `enako-os`, `cash`, and `kyc`.
4. **Summary & Dev Gate:** Validates all active checks before staging or deploying.
