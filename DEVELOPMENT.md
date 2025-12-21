# Development Environment Setup

This project can be run in both **Cursor** (local development) and **Replit** (cloud development). Each environment has its own npm script optimized for its setup.

## Running in Replit

Replit automatically manages environment variables through its Secrets pane, so no `.env` file is needed.

**Command:**
```bash
npm run dev
```

This runs: `NODE_ENV=development tsx server/index.ts`

### Setting Environment Variables in Replit:
1. Click on the "Secrets" icon in the left sidebar (🔒)
2. Add your environment variables as key-value pairs
3. They'll be automatically available to the application

## Running in Cursor (Local Development)

Cursor requires a `.env` file to load environment variables.

**Command:**
```bash
npm run dev:cursor
```

This runs: `dotenv-cli -e .env -- tsx server/index.ts`

### Setting Environment Variables in Cursor:
1. Create a `.env` file in the root directory
2. Add your environment variables:
   ```env
   DATABASE_URL=your_database_url
   REPL_ID=your_repl_id
   # Add other variables as needed
   ```
3. The `.env` file is gitignored for security

## Available Scripts

| Script | Environment | Description |
|--------|-------------|-------------|
| `npm run dev` | **Replit** | Start the app in Replit (uses Replit Secrets) |
| `npm run dev:cursor` | **Cursor** | Start the app in Cursor (uses .env file) |
| `npm run build` | Both | Build the production bundle |
| `npm start` | Both | Run the production build |
| `npm run check` | Both | Run TypeScript type checking |
| `npm run db:push` | Both | Push database schema changes |

## Key Differences

### Replit:
- ✅ Environment variables managed through Secrets UI
- ✅ No `.env` file needed
- ✅ Automatic deployment and hosting
- ✅ Built-in database integration

### Cursor:
- ✅ Uses `.env` file for environment variables
- ✅ Full local development control
- ✅ Works offline
- ✅ Integrates with local tools and debuggers

## Quick Start

### First Time Setup (Cursor):
```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env

# 3. Edit .env with your credentials
nano .env

# 4. Run the app
npm run dev:cursor
```

### First Time Setup (Replit):
```bash
# 1. Dependencies are auto-installed
# 2. Set environment variables in Secrets pane
# 3. Click "Run" or use:
npm run dev
```

## Troubleshooting

**Error: `dotenv: not found` in Replit**
- Solution: Use `npm run dev` instead of `npm run dev:cursor`

**Error: Environment variables not loading in Cursor**
- Solution: Ensure `.env` file exists and use `npm run dev:cursor`

**Error: `dotenv-cli: not found` in Cursor**
- Solution: Run `npm install` to install all dependencies
