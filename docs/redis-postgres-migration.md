# Redis to Postgres: Zero-Downtime Migration Plan

This document outlines the phased strategy for migrating token data from Redis to Postgres with no service interruption or downtime.

This is a standard and very achievable engineering task. The key is a methodical approach that ensures data consistency before, during, and after the transition.

---

## The Strategy: Phased Migration

The core principle is to make Postgres a perfect, in-sync mirror of the data in Redis *before* switching the application to use it as the primary data source.

### Phase 1: Preparation (Offline)

This phase involves all the setup work, with no changes to the live application.

1.  **Define Postgres Schema:** Set up the `tokens` table in the Postgres database. The schema should be designed to hold the token data currently stored in Redis JSON objects. A `JSONB` column is recommended for the `attributes` array for easy migration.

    ```sql
    CREATE TABLE tokens (
        token_id INTEGER PRIMARY KEY,
        image_hash TEXT,
        metadata_hash TEXT,
        token_uri TEXT,
        holder_address VARCHAR(42),
        holder_username TEXT,
        holder_fid BIGINT,
        holder_display_name TEXT,
        holder_pfp_url TEXT,
        transaction_hash VARCHAR(66),
        "timestamp" TIMESTAMPTZ,
        attributes JSONB,
        source_type TEXT,
        source_cast_hash TEXT,
        total_eligible_reactors INTEGER
    );

    -- Create indexes for faster queries
    CREATE INDEX idx_tokens_holder_address ON tokens(holder_address);
    CREATE INDEX idx_tokens_holder_fid ON tokens(holder_fid);
    CREATE INDEX idx_tokens_attributes ON tokens USING GIN(attributes);
    ```

2.  **Write Migration Script:** Create a script (e.g., in Node.js or Python) that can perform the data transfer. This script must:
    *   Connect to both Redis and Postgres.
    *   Read a token's JSON data from Redis.
    *   Transform the JSON into the correct format for the Postgres table.
    *   Insert the record into Postgres using an "upsert" command (`INSERT ... ON CONFLICT (token_id) DO UPDATE SET ...`) to make it idempotent. This means it can be run multiple times without creating duplicates.

---

### Phase 2: Implement Dual Writes

This is the most critical step for achieving zero downtime.

1.  **Modify Application Code:** Locate the service or function in your application responsible for creating new tokens and saving them to Redis.
2.  **Add Postgres Write:** Augment this function to save the exact same data to your Postgres `tokens` table immediately after it successfully saves it to Redis.

From this point forward, all **new** data is written to both databases. The application continues to read from Redis, so the user experience is unchanged. Postgres is now being kept in sync for all new entries.

---

### Phase 3: Backfill Existing Data

With new data being handled, you now migrate the historical data.

1.  **Run the Migration Script:** Execute the script created in Phase 1.
2.  **The script will:**
    *   Safely iterate through all token keys in Redis (using `SCAN` is recommended over `KEYS *` to avoid blocking Redis).
    *   For each token, it reads the data and upserts it into Postgres.
    *   Because the script is idempotent, it won't cause errors if it encounters a token that was already written by the dual-write system.

At the end of this phase, Postgres is a complete and accurate mirror of all data in Redis.

---

### Phase 4: Switch Reads to Postgres

This is the final switchover.

1.  **Modify Application Code:** Go to every part of your application that reads token data from Redis.
2.  **Change the Read Path:** Modify the code to read from Postgres instead.
3.  **Deploy:** Deploy this application update.

Since Postgres was already a complete mirror, the data returned to users will be identical. The switch will be invisible to them.

---

### Phase 5: Cleanup

After running successfully on Postgres for a period (e.g., a few days) and confirming system stability:

1.  **Remove Dual Writes:** Refactor your application code to remove the logic that writes to Redis. The application should now only write to Postgres.
2.  **Remove Redis Reads:** Remove the old Redis client, libraries, and data access code from your application.
3.  **Decommission Redis:** Shut down and remove the Redis instance from your hosting environment to stop incurring costs.
