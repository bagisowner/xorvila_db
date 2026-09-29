# MCPANEL Database Migration Strategy

## Upgrading from Legacy JSON / Memory Storage to PostgreSQL

### 1. Zero Data Loss Principle
Before any migration starts, a non-destructive timestamped safety copy is created:
`db.json` -> `db.json.bak.<timestamp>`.

### 2. Automatic Legacy Migration Script
Run the automated migration runner:
```bash
npm run db:migrate:legacy
```

### What the Migrator Handles:
1. **Users**: Imports legacy accounts, generates secure scrypt hashes for plaintext passwords, sets verified status, and assigns default roles.
2. **Servers**: Imports server configurations (RAM, CPU, disk, ports, server types, Minecraft versions) into the PostgreSQL `servers` table with foreign key consistency.
3. **Settings**: Imports legacy configurations into the normalized `panel_settings` JSONB table.
4. **Validation**: Validates every record schema; logs skipped records in the migration report without aborting valid rows.
