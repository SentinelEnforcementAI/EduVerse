-- Creates the application role and database.
--
-- The application must connect as a NON-superuser: Postgres superusers bypass
-- row-level security entirely, which would silently disable tenant isolation.
-- This script runs as the container's bootstrap superuser (postgres) on first
-- start (docker-entrypoint-initdb.d) and in CI before the checks.
CREATE ROLE sentinel LOGIN PASSWORD 'sentinel_dev_password';
CREATE DATABASE sentinel_watch OWNER sentinel;
